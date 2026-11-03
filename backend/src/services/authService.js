import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { includeUsuario, mapUsuario } from '../repositories/usuarioRepository.js';
import { enviarRecuperacion } from './correo.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';
import { sha256, tokenAleatorio } from '../utils/crypto.js';
import { hashContrasena, verificarContrasena } from '../utils/password.js';

let hashFicticio;

async function hashDeRelleno() {
  if (!hashFicticio) hashFicticio = await hashContrasena('relleno-no-utilizado');
  return hashFicticio;
}

function firmar(usuarioId, sesionId) {
  return jwt.sign({ sub: usuarioId, sid: sesionId }, env.jwtSecret, {
    expiresIn: env.jwtTtl,
    algorithm: 'HS256',
  });
}

function expiracionRefresh() {
  return new Date(Date.now() + env.refreshTtlDays * 86400000);
}

async function emitir(tx, usuario, ctx) {
  const refresh = tokenAleatorio();
  const csrfToken = tokenAleatorio();
  const sesion = await tx.sesion.create({
    data: {
      usuarioId: usuario.id,
      refreshHash: sha256(refresh),
      csrfToken,
      agente: ctx.agente,
      ip: ctx.ip,
      expiraEn: expiracionRefresh(),
    },
  });
  return { access: firmar(usuario.id, sesion.id), refresh, csrfToken, sesionId: sesion.id };
}

export async function login({ correo, contrasena, ip, agente }) {
  const usuario = await prisma.usuario.findUnique({ where: { correo }, include: includeUsuario });
  const valida = await verificarContrasena(usuario?.contrasenaHash || await hashDeRelleno(), contrasena);
  if (!usuario || !valida) {
    await prisma.$transaction((tx) => auditar(tx, {
      usuarioId: usuario?.id ?? null,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario?.id ?? null,
      resultado: 'FALLO',
      ip,
      agente,
      detalle: { correo },
    }));
    throw new AppError(401, 'Credenciales inválidas', 'CREDENCIALES');
  }
  if (!usuario.activo) {
    await prisma.$transaction((tx) => auditar(tx, {
      usuarioId: usuario.id,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id,
      resultado: 'FALLO',
      ip,
      agente,
      detalle: { motivo: 'inactivo' },
    }));
    throw new AppError(403, 'El usuario está desactivado', 'USUARIO_INACTIVO');
  }

  const sesion = await prisma.$transaction(async (tx) => {
    const emitida = await emitir(tx, usuario, { ip, agente });
    await tx.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
    await auditar(tx, {
      usuarioId: usuario.id,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id,
      resultado: 'EXITO',
      ip,
      agente,
      detalle: { sesionId: emitida.sesionId },
    });
    return emitida;
  });

  return {
    access: sesion.access,
    refresh: sesion.refresh,
    csrfToken: sesion.csrfToken,
    usuario: mapUsuario({ ...usuario, ultimoAcceso: new Date() }),
  };
}

export async function refrescar(refreshPlano) {
  if (!refreshPlano) throw new AppError(401, 'No hay sesión para renovar', 'NO_AUTENTICADO');
  const refreshHash = sha256(refreshPlano);
  return prisma.$transaction(async (tx) => {
    const sesion = await tx.sesion.findUnique({
      where: { refreshHash },
      include: { usuario: { include: includeUsuario } },
    });
    if (!sesion || sesion.revocadaEn || sesion.expiraEn < new Date()) {
      throw new AppError(401, 'La sesión no es válida', 'SESION_INVALIDA');
    }
    if (!sesion.usuario.activo) throw new AppError(403, 'El usuario está desactivado', 'USUARIO_INACTIVO');
    const refresh = tokenAleatorio();
    const csrfToken = tokenAleatorio();
    await tx.sesion.update({
      where: { id: sesion.id },
      data: { refreshHash: sha256(refresh), csrfToken },
    });
    return {
      access: firmar(sesion.usuarioId, sesion.id),
      refresh,
      csrfToken,
      usuario: mapUsuario(sesion.usuario),
    };
  });
}

export async function revocarPorRefresh(refreshPlano) {
  if (!refreshPlano) return;
  await prisma.sesion.updateMany({
    where: { refreshHash: sha256(refreshPlano), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

export async function perfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: includeUsuario });
  if (!usuario) throw new AppError(404, 'Usuario no encontrado', 'NO_ENCONTRADO');
  return mapUsuario(usuario);
}

export async function cambiarClave(usuario, { contrasenaActual, contrasenaNueva }, ctx) {
  const registro = await prisma.usuario.findUnique({ where: { id: usuario.id } });
  const valida = await verificarContrasena(registro.contrasenaHash, contrasenaActual);
  if (!valida) throw new AppError(422, 'La contraseña actual no es correcta', 'CLAVE_ACTUAL');
  const contrasenaHash = await hashContrasena(contrasenaNueva);
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { contrasenaHash, debeCambiarClave: false },
    });
    await tx.sesion.updateMany({
      where: { usuarioId: usuario.id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    const actualizado = await tx.usuario.findUnique({ where: { id: usuario.id }, include: includeUsuario });
    const emitida = await emitir(tx, actualizado, ctx);
    await auditar(tx, {
      usuarioId: usuario.id,
      accion: 'CAMBIAR_CLAVE',
      entidad: 'Usuario',
      entidadId: usuario.id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: {},
    });
    return { ...emitida, usuario: mapUsuario(actualizado) };
  });
}

export async function recuperar({ correo, ip, agente }) {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (usuario?.activo) {
    const token = tokenAleatorio();
    await prisma.$transaction(async (tx) => {
      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId: usuario.id, usadoEn: null },
        data: { usadoEn: new Date() },
      });
      await tx.tokenRecuperacion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: sha256(token),
          expiraEn: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await auditar(tx, {
        usuarioId: usuario.id,
        accion: 'RECUPERAR_CLAVE',
        entidad: 'Usuario',
        entidadId: usuario.id,
        resultado: 'EXITO',
        ip,
        agente,
        detalle: {},
      });
    });
    enviarRecuperacion({ correo, url: `${env.appUrl}/restablecer?token=${token}` });
  }
  return { mensaje: 'Si el correo está registrado, se generó un enlace de recuperación.' };
}

export async function restablecer({ token, contrasena, ip, agente }) {
  const tokenHash = sha256(token);
  const contrasenaHash = await hashContrasena(contrasena);
  await prisma.$transaction(async (tx) => {
    const registro = await tx.tokenRecuperacion.findUnique({ where: { tokenHash } });
    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
      throw new AppError(422, 'El enlace de recuperación no es válido o expiró', 'TOKEN_RECUPERACION');
    }
    await tx.tokenRecuperacion.update({ where: { id: registro.id }, data: { usadoEn: new Date() } });
    await tx.usuario.update({
      where: { id: registro.usuarioId },
      data: { contrasenaHash, debeCambiarClave: false },
    });
    await tx.sesion.updateMany({
      where: { usuarioId: registro.usuarioId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    await auditar(tx, {
      usuarioId: registro.usuarioId,
      accion: 'RESTABLECER_CLAVE',
      entidad: 'Usuario',
      entidadId: registro.usuarioId,
      resultado: 'EXITO',
      ip,
      agente,
      detalle: {},
    });
  });
  return { mensaje: 'La contraseña fue actualizada. Inicie sesión de nuevo.' };
}

export async function sesiones(usuario) {
  const lista = await prisma.sesion.findMany({
    where: { usuarioId: usuario.id, revocadaEn: null, expiraEn: { gt: new Date() } },
    orderBy: { creadoEn: 'desc' },
  });
  return lista.map((sesion) => ({
    id: sesion.id,
    agente: sesion.agente,
    ip: sesion.ip,
    creadoEn: sesion.creadoEn,
    expiraEn: sesion.expiraEn,
    actual: sesion.id === usuario.sesionId,
  }));
}

export async function revocarSesion(usuario, sesionId, ctx) {
  const sesion = await prisma.sesion.findFirst({ where: { id: sesionId, usuarioId: usuario.id } });
  if (!sesion) throw new AppError(404, 'Sesión no encontrada', 'NO_ENCONTRADO');
  await prisma.$transaction(async (tx) => {
    await tx.sesion.update({ where: { id: sesion.id }, data: { revocadaEn: new Date() } });
    await auditar(tx, {
      usuarioId: usuario.id,
      accion: 'REVOCAR_SESION',
      entidad: 'Sesion',
      entidadId: sesion.id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: {},
    });
  });
  return { actual: sesion.id === usuario.sesionId };
}
