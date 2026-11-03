import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

function whereBusqueda(q) {
  const filtro = contiene(q);
  if (!filtro) return {};
  return { OR: [{ nombre: filtro }, { codigo: filtro }, { nit: filtro }] };
}

export async function listar({ pagina, tamano, q }) {
  const where = whereBusqueda(q);
  const [total, datos] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({ where, orderBy: { nombre: 'asc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'CLI');
    const cliente = await tx.cliente.create({
      data: {
        codigo,
        nombre: datos.nombre,
        nit: datos.nit || null,
        correo: datos.correo || null,
        telefono: datos.telefono || null,
        direccion: datos.direccion || null,
      },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_CLIENTE', entidad: 'Cliente', entidadId: cliente.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo },
    });
    return cliente;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.cliente.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Cliente no encontrado', 'NO_ENCONTRADO');
    const cliente = await tx.cliente.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        nit: datos.nit || null,
        correo: datos.correo || null,
        telefono: datos.telefono || null,
        direccion: datos.direccion || null,
        activo: datos.activo,
      },
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_CLIENTE', entidad: 'Cliente', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: cliente.codigo },
    });
    return cliente;
  });
}
