import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';

export function listar() {
  return prisma.politicaSla.findMany({ orderBy: { prioridad: 'asc' } });
}

export async function actualizar(actor, prioridad, datos, ctx) {
  if (datos.minutosResolucion < datos.minutosRespuesta) {
    throw new AppError(422, 'La resolución no puede ser menor que el tiempo de respuesta', 'SLA');
  }
  return prisma.$transaction(async (tx) => {
    const politica = await tx.politicaSla.upsert({
      where: { prioridad },
      create: { prioridad, ...datos },
      update: datos,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_SLA', entidad: 'PoliticaSla', entidadId: politica.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { prioridad, ...datos },
    });
    return politica;
  });
}
