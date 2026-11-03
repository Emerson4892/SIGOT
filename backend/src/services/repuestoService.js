import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

const include = { categoria: true };

export async function listar({ pagina, tamano, q, bajoMinimo }) {
  const filtro = contiene(q);
  const where = filtro ? { OR: [{ nombre: filtro }, { codigo: filtro }, { descripcion: filtro }] } : {};
  const filas = await prisma.repuesto.findMany({ where, include, orderBy: { nombre: 'asc' } });
  const filtradas = bajoMinimo === 'true' ? filas.filter((item) => item.stock <= item.stockMinimo) : filas;
  const inicio = salto(pagina, tamano);
  return {
    datos: filtradas.slice(inicio, inicio + tamano),
    meta: metaLista(filtradas.length, pagina, tamano),
  };
}

export async function alertas() {
  const filas = await prisma.repuesto.findMany({ where: { estado: 'ACTIVO' }, include, orderBy: { stock: 'asc' } });
  return filas.filter((item) => item.stock <= item.stockMinimo);
}

export async function categorias() {
  return prisma.categoriaRepuesto.findMany({ orderBy: { nombre: 'asc' } });
}

export async function crearCategoria(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const categoria = await tx.categoriaRepuesto.create({ data: { nombre: datos.nombre, descripcion: datos.descripcion || null } });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_CATEGORIA_REPUESTO', entidad: 'CategoriaRepuesto', entidadId: categoria.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { nombre: datos.nombre },
    });
    return categoria;
  });
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const categoria = await tx.categoriaRepuesto.findUnique({ where: { id: datos.categoriaId } });
    if (!categoria) throw new AppError(422, 'La categoría no existe', 'CATEGORIA');
    const repuesto = await tx.repuesto.create({
      data: {
        codigo: datos.codigo?.trim() || await siguienteCodigo(tx, 'REP'),
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        categoriaId: datos.categoriaId,
        stock: datos.stock ?? 0,
        stockMinimo: datos.stockMinimo ?? 0,
        ubicacionAlmacen: datos.ubicacionAlmacen || null,
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_REPUESTO', entidad: 'Repuesto', entidadId: repuesto.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: repuesto.codigo },
    });
    return repuesto;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.repuesto.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Repuesto no encontrado', 'NO_ENCONTRADO');
    const repuesto = await tx.repuesto.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        categoriaId: datos.categoriaId,
        stockMinimo: datos.stockMinimo,
        ubicacionAlmacen: datos.ubicacionAlmacen || null,
        estado: datos.estado,
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_REPUESTO', entidad: 'Repuesto', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: repuesto.codigo },
    });
    return repuesto;
  });
}
