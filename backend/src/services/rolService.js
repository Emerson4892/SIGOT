import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';

function presentarRol(rol) {
  return {
    id: rol.id,
    codigo: rol.codigo,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    permisos: (rol.permisos || []).map((enlace) => enlace.permiso.codigo),
  };
}

const includeRol = { permisos: { include: { permiso: true } } };

export async function listarRoles() {
  const roles = await prisma.rol.findMany({ include: includeRol, orderBy: { nombre: 'asc' } });
  return roles.map(presentarRol);
}

export async function listarPermisos() {
  return prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }] });
}

export async function actualizarPermisos(actor, rolId, codigos, ctx) {
  return prisma.$transaction(async (tx) => {
    const rol = await tx.rol.findUnique({ where: { id: rolId }, include: includeRol });
    if (!rol) throw new AppError(404, 'Rol no encontrado', 'NO_ENCONTRADO');
    if (rol.codigo === 'ADMINISTRADOR' && !codigos.includes('roles.escribir')) {
      throw new AppError(409, 'El administrador debe conservar la gestión de roles', 'ROL_PROTEGIDO');
    }
    const permisos = await tx.permiso.findMany({ where: { codigo: { in: codigos } } });
    if (permisos.length !== new Set(codigos).size) {
      throw new AppError(422, 'Uno o más permisos no existen', 'PERMISO_INVALIDO');
    }
    await tx.rolPermiso.deleteMany({ where: { rolId } });
    await tx.rolPermiso.createMany({ data: permisos.map((permiso) => ({ rolId, permisoId: permiso.id })) });
    await auditar(tx, {
      usuarioId: actor.id,
      accion: 'CAMBIAR_PERMISOS',
      entidad: 'Rol',
      entidadId: rolId,
      resultado: 'EXITO',
      ip: ctx.ip,
      agente: ctx.agente,
      detalle: { codigo: rol.codigo, permisos: codigos },
    });
    return presentarRol(await tx.rol.findUnique({ where: { id: rolId }, include: includeRol }));
  });
}
