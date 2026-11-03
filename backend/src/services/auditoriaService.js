import { prisma } from '../config/db.js';
import { hashAuditoria } from './trazabilidad.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

export async function listar({ pagina, tamano, q, accion, entidad, resultado, desde, hasta }) {
  const filtro = contiene(q);
  const creadoEn = {
    ...(desde ? { gte: new Date(desde) } : {}),
    ...(hasta ? { lte: new Date(hasta) } : {}),
  };
  const where = {
    ...(accion ? { accion } : {}),
    ...(entidad ? { entidad } : {}),
    ...(resultado ? { resultado } : {}),
    ...(Object.keys(creadoEn).length ? { creadoEn } : {}),
    ...(filtro ? { OR: [{ accion: filtro }, { entidad: filtro }, { entidadId: filtro }] } : {}),
  };
  const [total, datos] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where,
      include: { usuario: { select: { nombre: true, apellido: true, correo: true } } },
      orderBy: { secuencia: 'desc' },
      skip: salto(pagina, tamano),
      take: tamano,
    }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function verificar() {
  const filas = await prisma.auditoria.findMany({ orderBy: { secuencia: 'asc' } });
  let previo = 'GENESIS';
  for (const fila of filas) {
    const hash = hashAuditoria(fila);
    if (fila.hashPrevio !== previo || fila.hash !== hash) {
      return { integra: false, secuencia: fila.secuencia, total: filas.length };
    }
    previo = fila.hash;
  }
  return { integra: true, total: filas.length };
}
