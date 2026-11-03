import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

export async function listar({ pagina, tamano, q }) {
  const filtro = contiene(q);
  const where = filtro ? { OR: [{ nombre: filtro }, { codigo: filtro }] } : {};
  const [total, datos] = await Promise.all([
    prisma.tipoActivo.count({ where }),
    prisma.tipoActivo.findMany({ where, orderBy: { nombre: 'asc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'TPA');
    const tipo = await tx.tipoActivo.create({
      data: { codigo, nombre: datos.nombre, descripcion: datos.descripcion || null },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_TIPO_ACTIVO', entidad: 'TipoActivo', entidadId: tipo.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo },
    });
    return tipo;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.tipoActivo.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Tipo de activo no encontrado', 'NO_ENCONTRADO');
    const tipo = await tx.tipoActivo.update({
      where: { id },
      data: { nombre: datos.nombre, descripcion: datos.descripcion || null, activo: datos.activo },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_TIPO_ACTIVO', entidad: 'TipoActivo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: tipo.codigo },
    });
    return tipo;
  });
}
