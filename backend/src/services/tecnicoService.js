import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { contiene, metaLista, salto } from '../utils/lista.js';
import { hashContrasena } from '../utils/password.js';

const include = {
  usuario: { select: { id: true, correo: true, nombre: true, apellido: true, telefono: true, activo: true } },
  membresias: { include: { cuadrilla: { select: { id: true, nombre: true, codigo: true } } } },
};

export async function listar({ pagina, tamano, q }) {
  const filtro = contiene(q);
  const where = filtro ? {
    OR: [
      { codigoEmpleado: filtro },
      { especialidad: filtro },
      { usuario: { nombre: filtro } },
      { usuario: { apellido: filtro } },
      { usuario: { correo: filtro } },
    ],
  } : {};
  const [total, datos] = await Promise.all([
    prisma.tecnico.count({ where }),
    prisma.tecnico.findMany({ where, include, orderBy: { codigoEmpleado: 'asc' }, skip: salto(pagina, tamano), take: tamano }),
  ]);
  return { datos, meta: metaLista(total, pagina, tamano) };
}

export async function crear(actor, datos, ctx) {
  const contrasenaHash = await hashContrasena(datos.contrasena);
  return prisma.$transaction(async (tx) => {
    const rol = await tx.rol.findUnique({ where: { codigo: 'TECNICO' } });
    if (!rol) throw new AppError(500, 'El rol de técnico no está inicializado', 'ROL');
    const usuario = await tx.usuario.create({
      data: {
        correo: datos.correo,
        contrasenaHash,
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || null,
        debeCambiarClave: true,
        roles: { create: [{ rolId: rol.id }] },
      },
    });
    const tecnico = await tx.tecnico.create({
      data: {
        usuarioId: usuario.id,
        codigoEmpleado: datos.codigoEmpleado?.trim() || await siguienteCodigo(tx, 'TEC'),
        especialidad: datos.especialidad || null,
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'CREAR_TECNICO', entidad: 'Tecnico', entidadId: tecnico.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { correo: datos.correo },
    });
    return tecnico;
  });
}

export async function actualizar(actor, id, datos, ctx) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.tecnico.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'Técnico no encontrado', 'NO_ENCONTRADO');
    await tx.usuario.update({
      where: { id: actual.usuarioId },
      data: { nombre: datos.nombre, apellido: datos.apellido, telefono: datos.telefono || null, activo: datos.activo },
    });
    const tecnico = await tx.tecnico.update({
      where: { id },
      data: { especialidad: datos.especialidad || null, activo: datos.activo },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EDITAR_TECNICO', entidad: 'Tecnico', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return tecnico;
  });
}
