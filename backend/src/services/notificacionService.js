import { prisma } from '../config/db.js';

export async function listar(usuarioId) {
  const [datos, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where: { usuarioId },
      orderBy: { creadoEn: 'desc' },
      take: 30,
    }),
    prisma.notificacion.count({ where: { usuarioId, leida: false } }),
  ]);
  return { datos, noLeidas };
}

export function marcarLeida(usuarioId, id) {
  return prisma.notificacion.updateMany({ where: { id, usuarioId }, data: { leida: true } });
}

export function marcarTodas(usuarioId) {
  return prisma.notificacion.updateMany({ where: { usuarioId, leida: false }, data: { leida: true } });
}
