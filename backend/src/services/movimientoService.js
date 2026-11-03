import { prisma } from '../config/db.js';
import { auditar, notificarUsuarios, usuariosConPermiso } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';
import { metaLista, salto } from '../utils/lista.js';
import { conIdempotencia } from '../utils/transaccion.js';

const ENTRADAS = new Set(['ENTRADA', 'DEVOLUCION']);
const SALIDAS = new Set(['SALIDA', 'ENTREGA']);

export async function listar({ pagina, tamano, repuestoId, tipo, ordenId }) {
  const where = {
    ...(repuestoId ? { repuestoId } : {}),
    ...(tipo ? { tipo } : {}),
    ...(ordenId ? { ordenId } : {}),
  };
  const [total, datos] = await Promise.all([
    prisma.movimientoRepuesto.count({ where }),
    prisma.movimientoRepuesto.findMany({
      where,
      include: {
        repuesto: { select: { id: true, codigo: true, nombre: true } },
        orden: { select: { id: true, codigo: true } },
        realizadoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { creadoEn: 'desc' },
      skip: salto(pagina, tamano),
      take: tamano,
    }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export function registrar(actor, datos, ctx, clave) {
  if (datos.tipo === 'CONSUMO') {
    throw new AppError(422, 'El consumo se registra desde la orden de trabajo', 'MOVIMIENTO');
  }
  return conIdempotencia(actor.id, clave, 'movimiento', async (tx) => {
    if (datos.clientMutationId) {
      const previo = await tx.movimientoRepuesto.findUnique({ where: { clientMutationId: datos.clientMutationId } });
      if (previo) return previo;
    }
    const repuesto = await tx.repuesto.findUnique({ where: { id: datos.repuestoId } });
    if (!repuesto || repuesto.estado !== 'ACTIVO') throw new AppError(422, 'El repuesto no está disponible', 'REPUESTO');
    let stockResultante;
    if (SALIDAS.has(datos.tipo)) {
      const descuento = await tx.repuesto.updateMany({
        where: { id: repuesto.id, stock: { gte: datos.cantidad } },
        data: { stock: { decrement: datos.cantidad } },
      });
      if (descuento.count !== 1) throw new AppError(409, 'Stock insuficiente', 'STOCK');
    } else if (ENTRADAS.has(datos.tipo)) {
      await tx.repuesto.update({ where: { id: repuesto.id }, data: { stock: { increment: datos.cantidad } } });
    } else {
      throw new AppError(422, 'Tipo de movimiento no admitido', 'MOVIMIENTO');
    }
    const fresco = await tx.repuesto.findUnique({ where: { id: repuesto.id } });
    stockResultante = fresco.stock;
    const movimiento = await tx.movimientoRepuesto.create({
      data: {
        repuestoId: repuesto.id,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        stockResultante,
        ordenId: datos.ordenId || null,
        realizadoPorId: actor.id,
        notas: datos.notas || null,
        clientMutationId: datos.clientMutationId || null,
      },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'MOVIMIENTO_REPUESTO', entidad: 'Repuesto', entidadId: repuesto.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente,
      detalle: { tipo: datos.tipo, cantidad: datos.cantidad, stock: stockResultante, ordenId: datos.ordenId || null },
    });
    if (fresco.stock <= fresco.stockMinimo) {
      const bodega = await usuariosConPermiso(tx, 'movimientos.escribir');
      await notificarUsuarios(tx, bodega.map((u) => u.id), {
        titulo: 'Stock bajo',
        mensaje: `${repuesto.codigo} quedó en ${fresco.stock}.`,
        enlace: '/repuestos',
      });
    }
    return movimiento;
  });
}
