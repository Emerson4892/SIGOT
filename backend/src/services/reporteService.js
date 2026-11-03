import { prisma } from '../config/db.js';
import { aCsv } from '../utils/csv.js';
import { marcarIncumplimientos } from './ordenService.js';

function rango(desde, hasta) {
  return {
    ...(desde ? { gte: new Date(desde) } : {}),
    ...(hasta ? { lte: new Date(hasta) } : {}),
  };
}

export async function operativo({ desde, hasta, prioridad, clienteId }) {
  await marcarIncumplimientos();
  const creadoEn = rango(desde, hasta);
  return prisma.ordenTrabajo.findMany({
    where: {
      ...(Object.keys(creadoEn).length ? { creadoEn } : {}),
      ...(prioridad ? { prioridad } : {}),
      ...(clienteId ? { activo: { clienteId } } : {}),
    },
    include: {
      activo: { select: { codigo: true, nombre: true, cliente: { select: { nombre: true } } } },
      tecnico: { include: { usuario: { select: { nombre: true, apellido: true } } } },
    },
    orderBy: { creadoEn: 'desc' },
    take: 500,
  });
}

export async function sla(filtros) {
  const ordenes = await operativo(filtros);
  const finalizadas = ordenes.filter((orden) => orden.estado === 'FINALIZADA');
  const cumplidas = finalizadas.filter((orden) => !orden.slaResolucionIncumplido).length;
  return {
    total: ordenes.length,
    finalizadas: finalizadas.length,
    cumplidas,
    incumplidas: finalizadas.length - cumplidas,
    vencidasAbiertas: ordenes.filter((orden) => orden.slaResolucionIncumplido && !['FINALIZADA', 'CANCELADA'].includes(orden.estado)).length,
    ordenes,
  };
}

export async function exportar(tipo, filtros) {
  if (tipo === 'sla') {
    const datos = await sla(filtros);
    const filas = [[
      'Codigo', 'Titulo', 'Prioridad', 'Estado', 'Cliente', 'Activo', 'SLA resolucion incumplido', 'Creada',
    ], ...datos.ordenes.map((orden) => [
      orden.codigo, orden.titulo, orden.prioridad, orden.estado, orden.activo?.cliente?.nombre,
      orden.activo?.codigo, orden.slaResolucionIncumplido ? 'SI' : 'NO', orden.creadoEn.toISOString(),
    ])];
    return { nombre: 'reporte-sla.csv', contenido: aCsv(filas) };
  }
  const ordenes = await operativo(filtros);
  const filas = [[
    'Codigo', 'Titulo', 'Prioridad', 'Estado', 'Cliente', 'Activo', 'Tecnico', 'Creada',
  ], ...ordenes.map((orden) => [
    orden.codigo,
    orden.titulo,
    orden.prioridad,
    orden.estado,
    orden.activo?.cliente?.nombre,
    orden.activo?.codigo,
    orden.tecnico ? `${orden.tecnico.usuario.nombre} ${orden.tecnico.usuario.apellido}` : '',
    orden.creadoEn.toISOString(),
  ])];
  return { nombre: 'reporte-operativo.csv', contenido: aCsv(filas) };
}
