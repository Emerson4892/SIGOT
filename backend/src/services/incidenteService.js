import { prisma } from '../config/db.js';
import { crearEn } from './ordenService.js';
import { auditar, cambiarEstadoActivo, registrarHistorial } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

const include = {
  activo: { select: { id: true, codigo: true, nombre: true, estado: true } },
  reportadoPor: { select: { id: true, nombre: true, apellido: true } },
  orden: { select: { id: true, codigo: true, estado: true } },
};

export async function listar({ pagina, tamano, q, estado, prioridad }) {
  const filtro = contiene(q);
  const where = {
    ...(estado ? { estado } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(filtro ? { OR: [{ codigo: filtro }, { descripcion: filtro }, { activo: { nombre: filtro } }, { activo: { codigo: filtro } }] } : {}),
  };
  const [total, datos] = await Promise.all([
    prisma.incidente.count({ where }),
    prisma.incidente.findMany({ where, include, orderBy: { fechaReporte: 'desc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const activo = await tx.activo.findUnique({ where: { id: datos.activoId } });
    if (!activo) throw new AppError(422, 'El activo no existe', 'ACTIVO');
    if (activo.estado === 'RETIRADO') throw new AppError(422, 'El activo está retirado', 'ACTIVO');
    const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'INC');
    const incidente = await tx.incidente.create({
      data: {
        codigo,
        activoId: datos.activoId,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad,
        reportadoPorId: actor.id,
      },
      include,
    });
    if (!['RETIRADO', 'FUERA_DE_SERVICIO'].includes(activo.estado)) {
      await cambiarEstadoActivo(tx, {
        activo,
        estado: 'CON_FALLA',
        usuarioId: actor.id,
        descripcion: `Incidente ${codigo} reportado`,
      });
    }
    await registrarHistorial(tx, {
      activoId: activo.id,
      tipo: 'INCIDENTE',
      descripcion: datos.descripcion,
      referenciaTipo: 'Incidente',
      referenciaId: incidente.id,
      usuarioId: actor.id,
      detalle: { prioridad: datos.prioridad, codigo },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_INCIDENTE', entidad: 'Incidente', entidadId: incidente.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo, prioridad: datos.prioridad },
    });
    return incidente;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.incidente.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'Incidente no encontrado', 'NO_ENCONTRADO');
    if (actual.estado !== 'ABIERTO') throw new AppError(409, 'Solo se editan incidentes abiertos', 'TRANSICION');
    const incidente = await tx.incidente.update({
      where: { id },
      data: { descripcion: datos.descripcion, prioridad: datos.prioridad },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_INCIDENTE', entidad: 'Incidente', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: incidente.codigo },
    });
    return incidente;
  });
}

export async function convertir(actor, id, ctx) {
  return prisma.$transaction(async (tx) => {
    const incidente = await tx.incidente.findUnique({ where: { id } });
    if (!incidente) throw new AppError(404, 'Incidente no encontrado', 'NO_ENCONTRADO');
    if (incidente.estado !== 'ABIERTO') throw new AppError(409, 'El incidente ya no está abierto', 'TRANSICION');
    const orden = await crearEn(tx, actor, {
      activoId: incidente.activoId,
      incidenteId: incidente.id,
      titulo: `Atención del incidente ${incidente.codigo}`,
      descripcion: incidente.descripcion,
      prioridad: incidente.prioridad,
      origen: 'CORRECTIVO',
    }, ctx);
    await tx.incidente.update({ where: { id }, data: { estado: 'CONVERTIDO' } });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CONVERTIR_INCIDENTE', entidad: 'Incidente', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId: orden.id },
    });
    return orden;
  });
}

export async function cancelar(actor, id, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.incidente.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'Incidente no encontrado', 'NO_ENCONTRADO');
    if (actual.estado !== 'ABIERTO') throw new AppError(409, 'El incidente no se puede cancelar', 'TRANSICION');
    const incidente = await tx.incidente.update({ where: { id }, data: { estado: 'CANCELADO' }, include });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CANCELAR_INCIDENTE', entidad: 'Incidente', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return incidente;
  });
}
