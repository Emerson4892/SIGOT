import { prisma } from '../config/db.js';
import { marcarIncumplimientos } from './ordenService.js';

function contar(grupos, estado) {
  return grupos.find((grupo) => grupo.estado === estado)?._count?._all || 0;
}

export async function resumen() {
  await marcarIncumplimientos();
  const [activos, incidentesPendientes, ordenes, repuestos, tecnicosActivos, finalizadas, vencidas, fallas] = await Promise.all([
    prisma.activo.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.incidente.count({ where: { estado: 'ABIERTO' } }),
    prisma.ordenTrabajo.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.repuesto.findMany({ where: { estado: 'ACTIVO' }, select: { stock: true, stockMinimo: true } }),
    prisma.tecnico.count({ where: { activo: true } }),
    prisma.ordenTrabajo.findMany({ where: { estado: 'FINALIZADA' }, select: { slaResolucionIncumplido: true } }),
    prisma.ordenTrabajo.count({
      where: { slaResolucionIncumplido: true, estado: { notIn: ['FINALIZADA', 'CANCELADA'] } },
    }),
    prisma.incidente.groupBy({
      by: ['activoId'],
      _count: { activoId: true },
      orderBy: { _count: { activoId: 'desc' } },
      take: 5,
    }),
  ]);
  const totalActivos = activos.reduce((suma, grupo) => suma + grupo._count._all, 0);
  const abiertas = ordenes
    .filter((grupo) => !['FINALIZADA', 'CANCELADA'].includes(grupo.estado))
    .reduce((suma, grupo) => suma + grupo._count._all, 0);
  const cumplidas = finalizadas.filter((orden) => !orden.slaResolucionIncumplido).length;
  const incumplidas = finalizadas.filter((orden) => orden.slaResolucionIncumplido).length;
  const base = cumplidas + incumplidas;
  const activosFalla = await prisma.activo.findMany({
    where: { id: { in: fallas.map((item) => item.activoId) } },
    select: { id: true, codigo: true, nombre: true },
  });
  return {
    activos: {
      total: totalActivos,
      operativos: contar(activos, 'OPERATIVO'),
      conFalla: contar(activos, 'CON_FALLA'),
      enMantenimiento: contar(activos, 'EN_MANTENIMIENTO'),
      fueraDeServicio: contar(activos, 'FUERA_DE_SERVICIO'),
      retirados: contar(activos, 'RETIRADO'),
    },
    incidentesPendientes,
    ordenes: {
      abiertas,
      enProceso: contar(ordenes, 'EN_PROCESO'),
      finalizadas: contar(ordenes, 'FINALIZADA'),
      vencidas,
    },
    sla: {
      cumplidas,
      incumplidas,
      porcentaje: base === 0 ? 100 : Math.round((cumplidas / base) * 100),
    },
    repuestosBajoMinimo: repuestos.filter((item) => item.stock <= item.stockMinimo).length,
    tecnicosActivos,
    fallasRecurrentes: fallas.map((item) => ({
      ...activosFalla.find((activo) => activo.id === item.activoId),
      total: item._count.activoId,
    })),
  };
}
