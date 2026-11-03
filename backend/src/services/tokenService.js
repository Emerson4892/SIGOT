import { prisma } from '../config/db.js';
import { auditar } from './trazabilidad.js';
import { AppError } from '../utils/errors.js';
import { sha256, tokenAleatorio } from '../utils/crypto.js';
import { metaLista, salto } from '../utils/lista.js';

function presentar(token) {
  const estado = token.estado === 'ACTIVO' && token.expiraEn < new Date() ? 'EXPIRADO' : token.estado;
  return {
    id: token.id,
    ordenId: token.ordenId,
    orden: token.orden,
    proposito: token.proposito,
    estado,
    expiraEn: token.expiraEn,
    usadoEn: token.usadoEn,
    creadoEn: token.creadoEn,
    usuarioAutorizado: token.usuarioAutorizado,
  };
}

const include = {
  orden: { select: { id: true, codigo: true, prioridad: true } },
  usuarioAutorizado: { select: { id: true, nombre: true, apellido: true } },
};

export async function listar({ pagina, tamano, ordenId, estado }) {
  const where = {
    ...(ordenId ? { ordenId } : {}),
    ...(estado && estado !== 'EXPIRADO' ? { estado } : {}),
  };
  const [total, filas] = await Promise.all([
    prisma.tokenOperacion.count({ where }),
    prisma.tokenOperacion.findMany({
      where, include, orderBy: { creadoEn: 'desc' }, skip: salto(pagina, tamano), take: tamano,
    }),
  ]);
  const datos = filas.map(presentar).filter((token) => !estado || token.estado === estado);
  return { datos, meta: metaLista(estado === 'EXPIRADO' ? datos.length : total, pagina, tamano) };
}

export async function emitir(actor, { ordenId, usuarioAutorizadoId, minutos }, ctx) {
  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId } });
    if (!orden) throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
    if (orden.prioridad !== 'CRITICA') throw new AppError(422, 'El token solo aplica a órdenes críticas', 'TOKEN');
    const autorizado = await tx.usuario.findUnique({
      where: { id: usuarioAutorizadoId || actor.id },
      include: { roles: { include: { rol: { include: { permisos: { include: { permiso: true } } } } } } },
    });
    const permisos = new Set((autorizado?.roles || []).flatMap((enlace) => enlace.rol.permisos.map((item) => item.permiso.codigo)));
    if (!autorizado?.activo || !permisos.has('ordenes.aprobar')) {
      throw new AppError(422, 'El usuario autorizado no puede aprobar cierres', 'TOKEN');
    }
    const secreto = tokenAleatorio();
    const token = await tx.tokenOperacion.create({
      data: {
        ordenId,
        proposito: 'CIERRE_CRITICO',
        expiraEn: new Date(Date.now() + minutos * 60 * 1000),
        usuarioAutorizadoId: autorizado.id,
        creadoPorId: actor.id,
        tokenHash: sha256(secreto),
      },
      include,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'EMITIR_TOKEN', entidad: 'TokenOperacion', entidadId: token.id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId, minutos },
    });
    return { token: secreto, registro: presentar(token) };
  });
}

export async function revocar(actor, id, ctx) {
  return prisma.$transaction(async (tx) => {
    const token = await tx.tokenOperacion.findUnique({ where: { id }, include });
    if (!token) throw new AppError(404, 'Token no encontrado', 'NO_ENCONTRADO');
    if (token.estado !== 'ACTIVO') throw new AppError(409, 'El token ya no está activo', 'TOKEN');
    const actualizado = await tx.tokenOperacion.update({ where: { id }, data: { estado: 'REVOCADO' }, include });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'REVOCAR_TOKEN', entidad: 'TokenOperacion', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId: token.ordenId },
    });
    return presentar(actualizado);
  });
}
