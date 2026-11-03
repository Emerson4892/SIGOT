import { prisma } from '../config/db.js';
import { exigirEjecutor } from './alcance.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';
import { conIdempotencia } from '../utils/transaccion.js';

const include = { items: { orderBy: { posicion: 'asc' } }, tipoActivo: { select: { id: true, nombre: true } } };

export function listar() {
  return prisma.plantillaChecklist.findMany({ where: { activa: true }, include, orderBy: { nombre: 'asc' } });
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const plantilla = await tx.plantillaChecklist.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        tipoActivoId: datos.tipoActivoId || null,
        items: {
          create: datos.items.map((item, indice) => ({
            texto: item.texto,
            obligatorio: Boolean(item.obligatorio),
            posicion: item.posicion ?? indice + 1,
          })),
        },
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_CHECKLIST', entidad: 'PlantillaChecklist', entidadId: plantilla.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { nombre: datos.nombre },
    });
    return plantilla;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.plantillaChecklist.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Plantilla no encontrada', 'NO_ENCONTRADO');
    await tx.itemPlantilla.deleteMany({ where: { plantillaId: id } });
    const plantilla = await tx.plantillaChecklist.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        tipoActivoId: datos.tipoActivoId || null,
        activa: datos.activa,
        items: {
          create: datos.items.map((item, indice) => ({
            texto: item.texto,
            obligatorio: Boolean(item.obligatorio),
            posicion: item.posicion ?? indice + 1,
          })),
        },
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_CHECKLIST', entidad: 'PlantillaChecklist', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return plantilla;
  });
}

export function completar(usuario, ordenId, datos, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'checklist.completar', async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({
      where: { id: ordenId },
      include: { asignaciones: true, cuadrilla: { include: { miembros: true } } },
    });
    exigirEjecutor(usuario, orden);
    if (!['EN_PROCESO', 'RECHAZADA'].includes(orden.estado)) {
      throw new AppError(409, 'El checklist se completa durante el trabajo', 'TRANSICION');
    }
    const plantilla = await tx.plantillaChecklist.findUnique({ where: { id: datos.plantillaId }, include: { items: true } });
    if (!plantilla?.activa) throw new AppError(422, 'La plantilla no está disponible', 'CHECKLIST');
    const ids = new Set(plantilla.items.map((item) => item.id));
    if (datos.respuestas.some((respuesta) => !ids.has(respuesta.itemId))) {
      throw new AppError(422, 'Hay actividades que no pertenecen a la plantilla', 'CHECKLIST');
    }
    const checklist = await tx.checklistOrden.upsert({
      where: { ordenId_plantillaId: { ordenId, plantillaId: plantilla.id } },
      create: { ordenId, plantillaId: plantilla.id, tecnicoId: usuario.tecnicoId },
      update: { tecnicoId: usuario.tecnicoId },
    });
    for (const respuesta of datos.respuestas) {
      await tx.respuestaChecklist.upsert({
        where: { checklistId_itemId: { checklistId: checklist.id, itemId: respuesta.itemId } },
        create: {
          checklistId: checklist.id,
          itemId: respuesta.itemId,
          cumplida: respuesta.cumplida,
          observacion: respuesta.observacion || null,
        },
        update: { cumplida: respuesta.cumplida, observacion: respuesta.observacion || null },
      });
    }
    const guardadas = await tx.respuestaChecklist.findMany({ where: { checklistId: checklist.id } });
    const completas = plantilla.items
      .filter((item) => item.obligatorio)
      .every((item) => guardadas.some((respuesta) => respuesta.itemId === item.id && respuesta.cumplida));
    await tx.checklistOrden.update({
      where: { id: checklist.id },
      data: { completadoEn: completas ? new Date() : null },
    });
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'COMPLETAR_CHECKLIST', entidad: 'OrdenTrabajo', entidadId: ordenId,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { plantillaId: plantilla.id, completas },
    });
    return tx.checklistOrden.findUnique({
      where: { id: checklist.id },
      include: { respuestas: true, plantilla: { include: { items: { orderBy: { posicion: 'asc' } } } } },
    });
  });
}
