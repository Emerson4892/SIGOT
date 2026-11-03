import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';

const include = {
  responsable: { include: { usuario: { select: { nombre: true, apellido: true } } } },
  miembros: { include: { tecnico: { include: { usuario: { select: { nombre: true, apellido: true } } } } } },
};

async function validarMiembros(tx, responsableId, miembros) {
  const ids = [...new Set([responsableId, ...miembros])];
  const tecnicos = await tx.tecnico.findMany({ where: { id: { in: ids }, activo: true } });
  if (tecnicos.length !== ids.length) throw new AppError(422, 'Hay técnicos inexistentes o inactivos', 'TECNICO');
  return ids;
}

export async function listar({ pagina, tamano, q }) {
  const filtro = contiene(q);
  const where = filtro ? { OR: [{ nombre: filtro }, { codigo: filtro }] } : {};
  const [total, datos] = await Promise.all([
    prisma.cuadrilla.count({ where }),
    prisma.cuadrilla.findMany({ where, include, orderBy: { nombre: 'asc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const ids = await validarMiembros(tx, datos.responsableId, datos.miembros || []);
    const cuadrilla = await tx.cuadrilla.create({
      data: {
        codigo: datos.codigo?.trim() || await siguienteCodigo(tx, 'CUA'),
        nombre: datos.nombre,
        responsableId: datos.responsableId,
        miembros: {
          create: ids.map((tecnicoId) => ({
            tecnicoId,
            rol: tecnicoId === datos.responsableId ? 'RESPONSABLE' : 'MIEMBRO',
          })),
        },
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_CUADRILLA', entidad: 'Cuadrilla', entidadId: cuadrilla.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo: cuadrilla.codigo },
    });
    return cuadrilla;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.cuadrilla.findUnique({ where: { id } });
    if (!existe) throw new AppError(404, 'Cuadrilla no encontrada', 'NO_ENCONTRADO');
    const ids = await validarMiembros(tx, datos.responsableId, datos.miembros || []);
    await tx.cuadrillaMiembro.deleteMany({ where: { cuadrillaId: id } });
    const cuadrilla = await tx.cuadrilla.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        responsableId: datos.responsableId,
        activa: datos.activa,
        miembros: {
          create: ids.map((tecnicoId) => ({
            tecnicoId,
            rol: tecnicoId === datos.responsableId ? 'RESPONSABLE' : 'MIEMBRO',
          })),
        },
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_CUADRILLA', entidad: 'Cuadrilla', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return cuadrilla;
  });
}
