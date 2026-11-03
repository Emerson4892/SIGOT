import { prisma } from '../config/db.js';
import { mapUsuario, usuarioRepo } from '../repositories/usuarioRepository.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';
import { hashContrasena } from '../utils/password.js';

async function contarAdminsActivos(tx, exceptoId) {
  return tx.usuario.count({
    where: {
      activo: true,
      id: exceptoId ? { not: exceptoId } : undefined,
      roles: { some: { rol: { codigo: 'ADMINISTRADOR' } } },
    },
  });
}

async function rolesPorCodigo(tx, codigos) {
  const roles = await tx.rol.findMany({ where: { codigo: { in: codigos } } });
  if (roles.length !== new Set(codigos).size) {
    throw new AppError(422, 'Uno o más roles no existen', 'ROL_INVALIDO');
  }
  return roles;
}

async function sincronizarTecnico(tx, usuarioId, codigos) {
  const existente = await tx.tecnico.findUnique({ where: { usuarioId } });
  const esTecnico = codigos.includes('TECNICO');
  if (esTecnico && !existente) {
    const codigoEmpleado = await siguienteCodigo(tx, 'TEC');
    await tx.tecnico.create({ data: { usuarioId, codigoEmpleado, activo: true } });
  } else if (existente) {
    await tx.tecnico.update({ where: { id: existente.id }, data: { activo: esTecnico } });
  }
}

export async function listar({ pagina, tamano, q, activo }) {
  const filtro = contiene(q);
  const where = {
    ...(activo === 'true' ? { activo: true } : {}),
    ...(activo === 'false' ? { activo: false } : {}),
    ...(filtro ? { OR: [{ nombre: filtro }, { apellido: filtro }, { correo: filtro }] } : {}),
  };
  const [total, filas] = await Promise.all([
    usuarioRepo().contar(where),
    usuarioRepo().listar({ where, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos: filas.map(mapUsuario), meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  const contrasenaHash = await hashContrasena(datos.contrasena);
  return prisma.$transaction(async (tx) => {
    const roles = await rolesPorCodigo(tx, datos.roles);
    const usuario = await tx.usuario.create({
      data: {
        correo: datos.correo,
        contrasenaHash,
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || null,
        debeCambiarClave: true,
        roles: { create: roles.map((rol) => ({ rolId: rol.id })) },
      },
    });
    await sincronizarTecnico(tx, usuario.id, datos.roles);
    await auditar(tx, {
      usuarioId: actor.id,
      accion: 'CREAR_USUARIO',
      entidad: 'Usuario',
      entidadId: usuario.id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: { correo: usuario.correo, roles: datos.roles },
    });
    return mapUsuario(await usuarioRepo(tx).porId(usuario.id));
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await usuarioRepo(tx).porId(id);
    if (!actual) throw new AppError(404, 'Usuario no encontrado', 'NO_ENCONTRADO');
    await tx.usuario.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || null,
      },
    });
    await auditar(tx, {
      usuarioId: actor.id,
      accion: 'EDITAR_USUARIO',
      entidad: 'Usuario',
      entidadId: id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: { nombre: datos.nombre, apellido: datos.apellido },
    });
    return mapUsuario(await usuarioRepo(tx).porId(id));
  });
}

export async function asignarRoles(actor, id, codigos, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await usuarioRepo(tx).porId(id);
    if (!actual) throw new AppError(404, 'Usuario no encontrado', 'NO_ENCONTRADO');
    const eraAdmin = actual.roles.some((enlace) => enlace.rol.codigo === 'ADMINISTRADOR');
    if (eraAdmin && !codigos.includes('ADMINISTRADOR')) {
      const otros = await contarAdminsActivos(tx, id);
      if (otros === 0) throw new AppError(409, 'Debe permanecer al menos un administrador activo', 'ULTIMO_ADMIN');
    }
    const roles = await rolesPorCodigo(tx, codigos);
    await tx.usuarioRol.deleteMany({ where: { usuarioId: id } });
    await tx.usuarioRol.createMany({ data: roles.map((rol) => ({ usuarioId: id, rolId: rol.id })) });
    await sincronizarTecnico(tx, id, codigos);
    await auditar(tx, {
      usuarioId: actor.id,
      accion: 'CAMBIAR_ROLES',
      entidad: 'Usuario',
      entidadId: id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: { roles: codigos },
    });
    return mapUsuario(await usuarioRepo(tx).porId(id));
  });
}

export async function cambiarActivo(actor, id, activo, ctx) {
  if (actor.id === id && !activo) {
    throw new AppError(409, 'No puede desactivar su propio usuario', 'AUTO_DESACTIVACION');
  }
  return prisma.$transaction(async (tx) => {
    const actual = await usuarioRepo(tx).porId(id);
    if (!actual) throw new AppError(404, 'Usuario no encontrado', 'NO_ENCONTRADO');
    const eraAdmin = actual.activo && actual.roles.some((enlace) => enlace.rol.codigo === 'ADMINISTRADOR');
    if (eraAdmin && !activo) {
      const otros = await contarAdminsActivos(tx, id);
      if (otros === 0) throw new AppError(409, 'Debe permanecer al menos un administrador activo', 'ULTIMO_ADMIN');
    }
    await tx.usuario.update({ where: { id }, data: { activo } });
    if (!activo) {
      await tx.sesion.updateMany({ where: { usuarioId: id, revocadaEn: null }, data: { revocadaEn: new Date() } });
      if (actual.tecnico) await tx.tecnico.update({ where: { id: actual.tecnico.id }, data: { activo: false } });
    }
    await auditar(tx, {
      usuarioId: actor.id,
      accion: activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      entidad: 'Usuario',
      entidadId: id,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: {},
    });
    return mapUsuario(await usuarioRepo(tx).porId(id));
  });
}
