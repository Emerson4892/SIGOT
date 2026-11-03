import { prisma } from '../config/db.js';

export const includeUsuario = {
  tecnico: { select: { id: true, activo: true, codigoEmpleado: true } },
  roles: {
    include: {
      rol: {
        include: {
          permisos: { include: { permiso: { select: { codigo: true } } } },
        },
      },
    },
  },
};

export function mapUsuario(usuario) {
  if (!usuario) return null;
  const roles = (usuario.roles || []).map((enlace) => ({
    id: enlace.rol.id,
    codigo: enlace.rol.codigo,
    nombre: enlace.rol.nombre,
  }));
  const permisos = [...new Set((usuario.roles || []).flatMap((enlace) => (
    enlace.rol.permisos || []).map((rp) => rp.permiso.codigo)))];
  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono,
    activo: usuario.activo,
    debeCambiarClave: usuario.debeCambiarClave,
    ultimoAcceso: usuario.ultimoAcceso,
    creadoEn: usuario.creadoEn,
    roles,
    permisos,
    tecnicoId: usuario.tecnico?.id ?? null,
  };
}

export function usuarioRepo(db = prisma) {
  return {
    porId(id) {
      return db.usuario.findUnique({ where: { id }, include: includeUsuario });
    },
    porCorreo(correo) {
      return db.usuario.findUnique({ where: { correo }, include: includeUsuario });
    },
    listar({ skip, take, where }) {
      return db.usuario.findMany({
        where,
        include: includeUsuario,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        skip,
        take,
      });
    },
    contar(where) {
      return db.usuario.count({ where });
    },
  };
}
