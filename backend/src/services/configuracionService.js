import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';

const CLAVES = new Set(['evidencia_minima', 'checklist_obligatorio', 'nombre_sistema']);

export function obtener() {
  return prisma.configuracion.findMany({ orderBy: { clave: 'asc' } });
}

export async function actualizar(actor, valores, ctx) {
  return prisma.$transaction(async (tx) => {
    const entradas = Object.entries(valores);
    if (!entradas.length || entradas.some(([clave]) => !CLAVES.has(clave))) {
      throw new AppError(422, 'Hay claves de configuración no permitidas', 'CONFIGURACION');
    }
    if (valores.evidencia_minima != null && (!Number.isInteger(valores.evidencia_minima) || valores.evidencia_minima < 1)) {
      throw new AppError(422, 'La evidencia mínima debe ser un entero positivo', 'CONFIGURACION');
    }
    for (const [clave, valor] of entradas) {
      await tx.configuracion.upsert({ where: { clave }, create: { clave, valor }, update: { valor } });
    }
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_CONFIGURACION', entidad: 'Configuracion', entidadId: 'sistema',
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: valores,
    });
    return tx.configuracion.findMany({ orderBy: { clave: 'asc' } });
  });
}
