import { prisma } from '../config/db.js';
import { crearEn } from './ordenService.js';
import { auditar, registrarHistorial } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';
import { metaLista, salto } from '../utils/lista.js';

const include = {
  activo: { select: { id: true, codigo: true, nombre: true } },
  responsable: { include: { usuario: { select: { nombre: true, apellido: true } } } },
  orden: { select: { id: true, codigo: true, estado: true } },
};

export async function listar({ pagina, tamano, estado, activoId }) {
  const where = {
    ...(estado ? { estado } : {}),
    ...(activoId ? { activoId } : {}),
  };
  const [total, datos] = await Promise.all([
    prisma.mantenimientoPreventivo.count({ where }),
    prisma.mantenimientoPreventivo.findMany({
      where, include, orderBy: { fechaProgramada: 'asc' }, skip: salto(pagina, tamano), take: tamano,
    }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const [activo, responsable] = await Promise.all([
      tx.activo.findUnique({ where: { id: datos.activoId } }),
      tx.tecnico.findUnique({ where: { id: datos.responsableId } }),
    ]);
    if (!activo || activo.estado === 'RETIRADO') throw new AppError(422, 'El activo no está disponible', 'ACTIVO');
    if (!responsable?.activo) throw new AppError(422, 'El responsable no está disponible', 'TECNICO');
    const mantenimiento = await tx.mantenimientoPreventivo.create({
      data: {
        activoId: datos.activoId,
        descripcion: datos.descripcion,
        frecuencia: datos.frecuencia,
        fechaProgramada: new Date(datos.fechaProgramada),
        responsableId: datos.responsableId,
      },
      include,
    });
    await registrarHistorial(tx, {
      activoId: activo.id,
      tipo: 'MANTENIMIENTO',
      descripcion: `Mantenimiento programado: ${datos.descripcion}`,
      referenciaTipo: 'MantenimientoPreventivo',
      referenciaId: mantenimiento.id,
      usuarioId: actor.id,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_MANTENIMIENTO', entidad: 'MantenimientoPreventivo', entidadId: mantenimiento.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { frecuencia: datos.frecuencia },
    });
    return mantenimiento;
  });
}

export async function generarOrden(actor, id, ctx) {
  return prisma.$transaction(async (tx) => {
    const mantenimiento = await tx.mantenimientoPreventivo.findUnique({ where: { id }, include: { orden: true } });
    if (!mantenimiento) throw new AppError(404, 'Mantenimiento no encontrado', 'NO_ENCONTRADO');
    if (mantenimiento.orden && !['FINALIZADA', 'CANCELADA'].includes(mantenimiento.orden.estado)) {
      throw new AppError(409, 'Este mantenimiento ya tiene una orden abierta', 'DUPLICADO');
    }
    if (mantenimiento.estado === 'CANCELADO') throw new AppError(409, 'El mantenimiento está cancelado', 'TRANSICION');
    const orden = await crearEn(tx, actor, {
      activoId: mantenimiento.activoId,
      titulo: `Mantenimiento preventivo`,
      descripcion: mantenimiento.descripcion,
      prioridad: 'MEDIA',
      origen: 'PREVENTIVO',
    }, ctx);
    await tx.mantenimientoPreventivo.update({
      where: { id },
      data: { estado: 'ORDEN_GENERADA', ordenId: orden.id },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'GENERAR_ORDEN_PREVENTIVA', entidad: 'MantenimientoPreventivo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId: orden.id },
    });
    return orden;
  });
}
