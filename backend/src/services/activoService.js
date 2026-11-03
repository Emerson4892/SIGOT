import fs from 'fs/promises';
import QRCode from 'qrcode';
import { prisma } from '../config/db.js';
import { filtroAsignadas, ordenVisible, soloAsignadas } from './alcance.js';
import { auditar, registrarHistorial } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';
import { contenidoQr, qrCoincide } from '../utils/qr.js';
import { tokenAleatorio } from '../utils/crypto.js';

const include = {
  tipoActivo: { select: { id: true, nombre: true, codigo: true } },
  cliente: { select: { id: true, nombre: true, codigo: true } },
  ubicacion: { select: { id: true, nombre: true, codigo: true, direccion: true } },
};

function presentar(activo) {
  if (!activo) return activo;
  const { qrSecreto, ...resto } = activo;
  return resto;
}

export async function listar({ pagina, tamano, q, estado, clienteId }) {
  const filtro = contiene(q);
  const where = {
    ...(estado ? { estado } : {}),
    ...(clienteId ? { clienteId } : {}),
    ...(filtro ? { OR: [{ nombre: filtro }, { codigo: filtro }, { serie: filtro }, { marca: filtro }] } : {}),
  };
  const [total, filas] = await Promise.all([
    prisma.activo.count({ where }),
    prisma.activo.findMany({ where, include, orderBy: { creadoEn: 'desc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos: filas.map(presentar), meta: metaLista(total, pagina, tamano) };
}

export async function obtener(id) {
  const activo = await prisma.activo.findUnique({ where: { id }, include });
  if (!activo) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
  return presentar(activo);
}

async function validarRelaciones(tx, datos) {
  const [tipo, cliente, ubicacion] = await Promise.all([
    tx.tipoActivo.findUnique({ where: { id: datos.tipoActivoId } }),
    tx.cliente.findUnique({ where: { id: datos.clienteId } }),
    tx.ubicacion.findUnique({ where: { id: datos.ubicacionId } }),
  ]);
  if (!tipo?.activo) throw new AppError(422, 'El tipo de activo no está disponible', 'TIPO_ACTIVO');
  if (!cliente?.activo) throw new AppError(422, 'El cliente no está disponible', 'CLIENTE');
  if (!ubicacion?.activo || ubicacion.clienteId !== datos.clienteId) {
    throw new AppError(422, 'La ubicación no pertenece al cliente', 'UBICACION');
  }
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    await validarRelaciones(tx, datos);
    const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'ACT');
    const activo = await tx.activo.create({
      data: {
        codigo,
        nombre: datos.nombre,
        tipoActivoId: datos.tipoActivoId,
        marca: datos.marca || null,
        modelo: datos.modelo || null,
        serie: datos.serie || null,
        clienteId: datos.clienteId,
        ubicacionId: datos.ubicacionId,
        estado: datos.estado || 'OPERATIVO',
        qrSecreto: tokenAleatorio(24),
        notas: datos.notas || null,
      },
      include,
    });
    await registrarHistorial(tx, {
      activoId: activo.id,
      tipo: 'CAMBIO_ESTADO',
      descripcion: `Activo ${activo.codigo} registrado con estado ${activo.estado}`,
      usuarioId: actor.id,
      detalle: { estado: activo.estado },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_ACTIVO', entidad: 'Activo', entidadId: activo.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo },
    });
    return presentar(activo);
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.activo.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
    await validarRelaciones(tx, datos);
    const activo = await tx.activo.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        tipoActivoId: datos.tipoActivoId,
        marca: datos.marca || null,
        modelo: datos.modelo || null,
        serie: datos.serie || null,
        clienteId: datos.clienteId,
        ubicacionId: datos.ubicacionId,
        estado: datos.estado,
        notas: datos.notas || null,
      },
      include,
    });
    if (actual.estado !== activo.estado) {
      await registrarHistorial(tx, {
        activoId: id,
        tipo: 'CAMBIO_ESTADO',
        descripcion: `Estado del activo ${activo.codigo}: ${actual.estado} → ${activo.estado}`,
        usuarioId: actor.id,
        detalle: { anterior: actual.estado, nuevo: activo.estado },
      });
    }
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_ACTIVO', entidad: 'Activo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: activo.codigo },
    });
    return presentar(activo);
  });
}

export async function contenido(id) {
  const activo = await prisma.activo.findUnique({ where: { id } });
  if (!activo) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
  return { contenido: contenidoQr(activo), codigo: activo.codigo };
}

export async function imagenQr(id) {
  const { contenido: texto } = await contenido(id);
  return QRCode.toBuffer(texto, { type: 'png', width: 480, margin: 1, errorCorrectionLevel: 'M' });
}

export async function validarContraOrden(usuario, { ordenId, contenido: texto }, ctx) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id: ordenId },
    include: { activo: true, asignaciones: true, cuadrilla: { include: { miembros: true } } },
  });
  if (!orden) throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
  if (!ordenVisible(usuario, orden)) throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
  const valido = qrCoincide(orden.activo, texto);
  await prisma.$transaction((tx) => auditar(tx, {
    usuarioId: usuario.id,
    accion: 'VALIDAR_QR',
    entidad: 'Activo',
    entidadId: orden.activoId,
    resultado: valido ? 'EXITO' : 'FALLO',
    ip: ctx.ip,
    agente: ctx.agente,
    detalle: { ordenId, codigoActivo: orden.activo.codigo },
  }));
  if (!valido) throw new AppError(422, 'El código QR no corresponde al activo de la orden', 'QR_INVALIDO');
  return { valido: true, activo: presentar(orden.activo) };
}

export async function historial(usuario, activoId) {
  const activo = await prisma.activo.findUnique({ where: { id: activoId }, select: { id: true } });
  if (!activo) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
  const accesoAmplio = usuario.permisos.includes('activos.leer') || usuario.permisos.includes('ordenes.leer');
  if (!accesoAmplio) {
    if (!usuario.tecnicoId) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
    const relacionadas = await prisma.ordenTrabajo.count({
      where: { activoId, ...filtroAsignadas(usuario.tecnicoId) },
    });
    if (!relacionadas) throw new AppError(404, 'Activo no encontrado', 'NO_ENCONTRADO');
  }
  if (soloAsignadas(usuario) && !usuario.permisos.includes('historial.leer')) {
    throw new AppError(403, 'No tiene permiso para esta operación', 'PROHIBIDO');
  }
  return prisma.historialActivo.findMany({
    where: { activoId },
    orderBy: { creadoEn: 'desc' },
    include: { usuario: { select: { nombre: true, apellido: true } } },
  });
}

export async function asegurarDirectorio(dir) {
  await fs.mkdir(dir, { recursive: true });
}
