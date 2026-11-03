import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { exigirEjecutor, exigirVisible } from './alcance.js';
import { auditar, registrarHistorial } from './trazabilidad.js';
import { validarArchivo } from '../utils/archivos.js';
import { AppError } from '../utils/errors.js';
import { tokenAleatorio } from '../utils/crypto.js';
import { conIdempotencia } from '../utils/transaccion.js';

const includeOrden = {
  asignaciones: true,
  cuadrilla: { include: { miembros: true } },
  tecnico: { include: { usuario: { select: { id: true } } } },
};

export function adjuntar(usuario, ordenId, archivo, ctx, clave) {
  const validado = validarArchivo(archivo, env.maxUploadBytes);
  const nombreAlmacenado = `${tokenAleatorio(16)}${validado.ext}`;
  const destino = path.join(env.uploadDir, nombreAlmacenado);
  return conIdempotencia(usuario.id, clave, 'evidencia', async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, include: includeOrden });
    if (!orden) throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
    if (usuario.permisos.includes('ordenes.trabajar')) exigirEjecutor(usuario, orden);
    else exigirVisible(usuario, orden);
    if (!['EN_PROCESO', 'RECHAZADA'].includes(orden.estado)) {
      throw new AppError(409, 'Solo se adjuntan evidencias durante el trabajo', 'TRANSICION');
    }
    if (clave) {
      const previa = await tx.evidencia.findUnique({ where: { clientMutationId: clave } });
      if (previa) return previa;
    }
    await fs.mkdir(env.uploadDir, { recursive: true });
    await fs.writeFile(destino, archivo.buffer);
    try {
      const evidencia = await tx.evidencia.create({
        data: {
          ordenId,
          nombreOriginal: validado.nombreOriginal,
          nombreAlmacenado,
          mime: validado.mime,
          tamano: validado.tamano,
          subidaPorId: usuario.id,
          clientMutationId: clave,
        },
      });
      await registrarHistorial(tx, {
        activoId: orden.activoId,
        tipo: 'EVIDENCIA',
        descripcion: `Evidencia ${validado.nombreOriginal} en la orden ${orden.codigo}`,
        referenciaTipo: 'Evidencia',
        referenciaId: evidencia.id,
        usuarioId: usuario.id,
      });
      await auditar(tx, {
        usuarioId: usuario.id, accion: 'ADJUNTAR_EVIDENCIA', entidad: 'Evidencia', entidadId: evidencia.id,
        resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente,
        detalle: { ordenId, mime: validado.mime, tamano: validado.tamano },
      });
      return evidencia;
    } catch (error) {
      await fs.unlink(destino).catch(() => {});
      throw error;
    }
  });
}

export async function obtenerArchivo(usuario, id) {
  const evidencia = await prisma.evidencia.findUnique({
    where: { id },
    include: { orden: { include: includeOrden } },
  });
  if (!evidencia) throw new AppError(404, 'Evidencia no encontrada', 'NO_ENCONTRADO');
  exigirVisible(usuario, evidencia.orden);
  const ruta = path.join(env.uploadDir, path.basename(evidencia.nombreAlmacenado));
  const buffer = await fs.readFile(ruta);
  return { evidencia, buffer };
}
