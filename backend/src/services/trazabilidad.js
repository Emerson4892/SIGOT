import { createHash } from 'crypto';

function canon(valor) {
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor ?? null);
  if (Array.isArray(valor)) return `[${valor.map(canon).join(',')}]`;
  const claves = Object.keys(valor).filter((clave) => valor[clave] !== undefined).sort();
  return `{${claves.map((clave) => `${JSON.stringify(clave)}:${canon(valor[clave])}`).join(',')}}`;
}

export function hashAuditoria({ secuencia, usuarioId, accion, entidad, entidadId, resultado, detalle, hashPrevio }) {
  const material = canon({
    secuencia,
    usuarioId: usuarioId ?? null,
    accion,
    entidad,
    entidadId: entidadId ?? null,
    resultado,
    detalle: detalle ?? {},
    hashPrevio,
  });
  return createHash('sha256').update(material).digest('hex');
}

export async function auditar(tx, entrada) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(847291)`;
  const ultima = await tx.auditoria.findFirst({ orderBy: { secuencia: 'desc' } });
  const secuencia = (ultima?.secuencia ?? 0) + 1;
  const hashPrevio = ultima?.hash ?? 'GENESIS';
  const detalle = entrada.detalle ?? {};
  const hash = hashAuditoria({
    secuencia,
    usuarioId: entrada.usuarioId,
    accion: entrada.accion,
    entidad: entrada.entidad,
    entidadId: entrada.entidadId,
    resultado: entrada.resultado,
    detalle,
    hashPrevio,
  });
  return tx.auditoria.create({
    data: {
      secuencia,
      usuarioId: entrada.usuarioId ?? null,
      accion: entrada.accion,
      entidad: entrada.entidad,
      entidadId: entrada.entidadId ?? null,
      resultado: entrada.resultado,
      ip: entrada.ip ?? null,
      agente: entrada.agente?.slice(0, 300) ?? null,
      detalle,
      hashPrevio,
      hash,
    },
  });
}

export async function registrarHistorial(tx, datos) {
  return tx.historialActivo.create({
    data: {
      activoId: datos.activoId,
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      referenciaTipo: datos.referenciaTipo ?? null,
      referenciaId: datos.referenciaId ?? null,
      usuarioId: datos.usuarioId ?? null,
      detalle: datos.detalle ?? undefined,
    },
  });
}

export async function cambiarEstadoActivo(tx, { activo, estado, usuarioId, descripcion }) {
  if (!activo || activo.estado === estado) return activo;
  const actualizado = await tx.activo.update({
    where: { id: activo.id },
    data: { estado },
  });
  await registrarHistorial(tx, {
    activoId: activo.id,
    tipo: 'CAMBIO_ESTADO',
    descripcion,
    usuarioId,
    detalle: { anterior: activo.estado, nuevo: estado },
  });
  return actualizado;
}

export async function notificarUsuarios(tx, usuariosIds, notificacion) {
  const ids = [...new Set(usuariosIds.filter(Boolean))];
  if (!ids.length) return;
  await tx.notificacion.createMany({
    data: ids.map((usuarioId) => ({
      usuarioId,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      enlace: notificacion.enlace ?? null,
    })),
  });
}

export async function usuariosConPermiso(tx, codigo) {
  return tx.usuario.findMany({
    where: {
      activo: true,
      roles: { some: { rol: { permisos: { some: { permiso: { codigo } } } } } },
    },
    select: { id: true },
  });
}
