import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

const include = { cliente: { select: { id: true, nombre: true, codigo: true } } };

export async function listar({ pagina, tamano, q, clienteId }) {
  const filtro = contiene(q);
  const where = {
    ...(clienteId ? { clienteId } : {}),
    ...(filtro ? { OR: [{ nombre: filtro }, { codigo: filtro }, { ciudad: filtro }] } : {}),
  };
  const [total, datos] = await Promise.all([
    prisma.ubicacion.count({ where }),
    prisma.ubicacion.findMany({ where, include, orderBy: { nombre: 'asc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: datos.clienteId } });
    if (!cliente || !cliente.activo) throw new AppError(422, 'El cliente no está disponible', 'CLIENTE');
    const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'UBI');
    const ubicacion = await tx.ubicacion.create({
      data: {
        clienteId: datos.clienteId,
        codigo,
        nombre: datos.nombre,
        direccion: datos.direccion,
        ciudad: datos.ciudad || null,
        latitud: datos.latitud ?? null,
        longitud: datos.longitud ?? null,
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_UBICACION', entidad: 'Ubicacion', entidadId: ubicacion.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo, clienteId: datos.clienteId },
    });
    return ubicacion;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.ubicacion.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Ubicación no encontrada', 'NO_ENCONTRADO');
    const ubicacion = await tx.ubicacion.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        direccion: datos.direccion,
        ciudad: datos.ciudad || null,
        latitud: datos.latitud ?? null,
        longitud: datos.longitud ?? null,
        activo: datos.activo,
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_UBICACION', entidad: 'Ubicacion', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: ubicacion.codigo },
    });
    return ubicacion;
  });
}
