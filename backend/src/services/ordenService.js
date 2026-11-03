import { prisma } from '../config/db.js';
import { exigirEjecutor, exigirVisible, filtroAsignadas, soloAsignadas } from './alcance.js';
import { auditar, cambiarEstadoActivo, notificarUsuarios, registrarHistorial, usuariosConPermiso } from './trazabilidad.js';
import { siguienteCodigo } from '../utils/codigos.js';
import { AppError } from '../utils/errors.js';
import { ESTADOS_ABIERTOS, puedeTransicionar } from '../utils/estadosOrden.js';
import { sumarFrecuencia, sumarMinutos } from '../utils/fechas.js';
import { contiene, metaLista, salto } from '../utils/lista.js';
import { conIdempotencia } from '../utils/transaccion.js';
import { qrCoincide } from '../utils/qr.js';
import { sha256, tokenAleatorio } from '../utils/crypto.js';

const includeDetalle = {
  activo: {
    include: {
      cliente: { select: { id: true, nombre: true } },
      ubicacion: { select: { id: true, nombre: true, direccion: true } },
    },
  },
  incidente: { select: { id: true, codigo: true, descripcion: true, estado: true, prioridad: true } },
  tecnico: { include: { usuario: { select: { id: true, nombre: true, apellido: true } } } },
  cuadrilla: { include: { miembros: true } },
  asignaciones: {
    orderBy: { fechaAsignacion: 'desc' },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true, apellido: true } } } },
      cuadrilla: { select: { id: true, nombre: true, codigo: true } },
    },
  },
  evidencias: {
    orderBy: { creadoEn: 'desc' },
    select: { id: true, nombreOriginal: true, mime: true, tamano: true, creadoEn: true, subidaPorId: true },
  },
  checklists: {
    include: {
      plantilla: { include: { items: { orderBy: { posicion: 'asc' } } } },
      respuestas: true,
    },
  },
  aprobaciones: { orderBy: { solicitadoEn: 'desc' } },
  movimientos: { include: { repuesto: { select: { id: true, codigo: true, nombre: true } } } },
};

const includeLista = {
  activo: { select: { id: true, codigo: true, nombre: true, estado: true } },
  tecnico: { include: { usuario: { select: { nombre: true, apellido: true } } } },
  cuadrilla: { select: { id: true, nombre: true } },
};

function presentar(orden) {
  if (!orden?.activo) return orden;
  const { qrSecreto, ...activo } = orden.activo;
  return { ...orden, activo };
}

async function cargar(tx, id) {
  const orden = await tx.ordenTrabajo.findUnique({ where: { id }, include: includeDetalle });
  if (!orden) throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
  return orden;
}

async function politica(tx, prioridad) {
  const sla = await tx.politicaSla.findUnique({ where: { prioridad } });
  if (!sla?.activa) throw new AppError(422, 'No hay una política SLA activa para esa prioridad', 'SLA');
  return sla;
}

export async function marcarIncumplimientos() {
  const ahora = new Date();
  await prisma.ordenTrabajo.updateMany({
    where: {
      slaResolucionIncumplido: false,
      slaResolucionVenceEn: { lt: ahora },
      estado: { notIn: ['FINALIZADA', 'CANCELADA'] },
    },
    data: { slaResolucionIncumplido: true },
  });
}

async function transicionar(tx, orden, estadoNuevo, usuarioId, motivo, extra = {}) {
  if (!puedeTransicionar(orden.estado, estadoNuevo)) {
    throw new AppError(409, `No se puede pasar de ${orden.estado} a ${estadoNuevo}`, 'TRANSICION');
  }
  const resultado = await tx.ordenTrabajo.updateMany({
    where: { id: orden.id, version: orden.version, estado: orden.estado },
    data: { estado: estadoNuevo, version: { increment: 1 }, ...extra },
  });
  if (resultado.count !== 1) {
    throw new AppError(409, 'La orden fue modificada de forma concurrente. Actualice e intente de nuevo.', 'CONCURRENCIA');
  }
  await tx.historialEstadoOrden.create({
    data: {
      ordenId: orden.id,
      estadoAnterior: orden.estado,
      estadoNuevo,
      motivo: motivo || null,
      cambiadoPorId: usuarioId,
    },
  });
  await registrarHistorial(tx, {
    activoId: orden.activoId,
    tipo: 'ORDEN',
    descripcion: `Orden ${orden.codigo}: ${orden.estado} → ${estadoNuevo}`,
    referenciaTipo: 'OrdenTrabajo',
    referenciaId: orden.id,
    usuarioId,
    detalle: { motivo: motivo || null },
  });
  return presentar(await cargar(tx, orden.id));
}

async function crearEn(tx, actor, datos, ctx) {
  const activo = await tx.activo.findUnique({ where: { id: datos.activoId } });
  if (!activo) throw new AppError(422, 'El activo no existe', 'ACTIVO');
  if (activo.estado === 'RETIRADO') throw new AppError(422, 'El activo está retirado', 'ACTIVO');
  const ahora = new Date();
  const sla = await politica(tx, datos.prioridad);
  const codigo = datos.codigo?.trim() || await siguienteCodigo(tx, 'OT');
  const orden = await tx.ordenTrabajo.create({
    data: {
      codigo,
      incidenteId: datos.incidenteId || null,
      activoId: datos.activoId,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      prioridad: datos.prioridad,
      origen: datos.origen || 'CORRECTIVO',
      abiertaPorId: actor.id,
      slaRespuestaVenceEn: sumarMinutos(ahora, sla.minutosRespuesta),
      slaResolucionVenceEn: sumarMinutos(ahora, sla.minutosResolucion),
    },
  });
  await tx.historialEstadoOrden.create({
    data: { ordenId: orden.id, estadoNuevo: 'PENDIENTE', motivo: 'Orden registrada', cambiadoPorId: actor.id },
  });
  await registrarHistorial(tx, {
    activoId: activo.id,
    tipo: 'ORDEN',
    descripcion: `Se registró la orden ${codigo}`,
    referenciaTipo: 'OrdenTrabajo',
    referenciaId: orden.id,
    usuarioId: actor.id,
  });
  await auditar(tx, {
    usuarioId: actor.id, accion: 'CREAR_ORDEN', entidad: 'OrdenTrabajo', entidadId: orden.id,
    resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { codigo, prioridad: datos.prioridad },
  });
  return presentar(await cargar(tx, orden.id));
}

export function crear(actor, datos, ctx, clave) {
  return conIdempotencia(actor.id, clave, 'orden.crear', (tx) => crearEn(tx, actor, datos, ctx));
}

export async function listar(usuario, consulta) {
  await marcarIncumplimientos();
  const { pagina, tamano, q, estado, prioridad, vencidas, proximas } = consulta;
  const filtro = contiene(q);
  const ahora = new Date();
  const pronto = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
  const partes = [];
  if (estado && vencidas !== 'true' && proximas !== 'true') partes.push({ estado });
  if (prioridad) partes.push({ prioridad });
  if (vencidas === 'true') {
    partes.push({ slaResolucionVenceEn: { lt: ahora }, estado: { notIn: ['FINALIZADA', 'CANCELADA'] } });
  }
  if (proximas === 'true') {
    partes.push({
      slaResolucionVenceEn: { gte: ahora, lte: pronto },
      slaResolucionIncumplido: false,
      estado: { notIn: ['FINALIZADA', 'CANCELADA'] },
    });
  }
  if (filtro) {
    partes.push({ OR: [{ codigo: filtro }, { titulo: filtro }, { activo: { nombre: filtro } }, { activo: { codigo: filtro } }] });
  }
  if (soloAsignadas(usuario)) partes.push(usuario.tecnicoId ? filtroAsignadas(usuario.tecnicoId) : { id: { in: [] } });
  const where = partes.length ? { AND: partes } : {};
  const [total, filas] = await Promise.all([
    prisma.ordenTrabajo.count({ where }),
    prisma.ordenTrabajo.findMany({
      where, include: includeLista, orderBy: { creadoEn: 'desc' }, skip: salto(pagina, tamano), take: tamano,
    }),
  ]);
  return { datos: filas.map(presentar), meta: metaLista(total, pagina, tamano) };
}

export async function obtener(usuario, id) {
  const orden = await prisma.ordenTrabajo.findUnique({ where: { id }, include: includeDetalle });
  exigirVisible(usuario, orden);
  return presentar(orden);
}

export async function historial(usuario, id) {
  await obtener(usuario, id);
  return prisma.historialEstadoOrden.findMany({
    where: { ordenId: id },
    orderBy: { creadoEn: 'asc' },
    include: { cambiadoPor: { select: { nombre: true, apellido: true } } },
  });
}

export function asignar(actor, id, datos, ctx, clave) {
  return conIdempotencia(actor.id, clave, 'orden.asignar', async (tx) => {
    const orden = await cargar(tx, id);
    if (!['PENDIENTE', 'ASIGNADA', 'ACEPTADA', 'RECHAZADA'].includes(orden.estado)) {
      throw new AppError(409, 'La orden no admite una asignación en su estado actual', 'TRANSICION');
    }
    if (!datos.tecnicoId && !datos.cuadrillaId) {
      throw new AppError(422, 'Indique un técnico o una cuadrilla', 'ASIGNACION');
    }
    let tecnico = null;
    let cuadrilla = null;
    if (datos.tecnicoId) {
      tecnico = await tx.tecnico.findUnique({ where: { id: datos.tecnicoId }, include: { usuario: true } });
      if (!tecnico?.activo || !tecnico.usuario.activo) throw new AppError(422, 'El técnico no está disponible', 'TECNICO');
    }
    if (datos.cuadrillaId) {
      cuadrilla = await tx.cuadrilla.findUnique({ where: { id: datos.cuadrillaId }, include: { miembros: true } });
      if (!cuadrilla?.activa) throw new AppError(422, 'La cuadrilla no está disponible', 'CUADRILLA');
    }
    await tx.asignacion.updateMany({
      where: { ordenId: id, estado: { in: ['PENDIENTE', 'ACEPTADA'] } },
      data: { estado: 'REASIGNADA' },
    });
    await tx.asignacion.create({
      data: {
        ordenId: id,
        tecnicoId: tecnico?.id || null,
        cuadrillaId: cuadrilla?.id || null,
        asignadoPorId: actor.id,
      },
    });
    await tx.ordenTrabajo.update({
      where: { id },
      data: { tecnicoId: tecnico?.id || null, cuadrillaId: cuadrilla?.id || null },
    });
    const actualizada = await cargar(tx, id);
    const destino = actualizada.estado === 'ASIGNADA' ? 'ASIGNADA' : 'ASIGNADA';
    const resultado = await transicionar(tx, actualizada, destino, actor.id, datos.motivo || 'Asignación registrada', {});
    const destinatarios = [];
    if (tecnico) destinatarios.push(tecnico.usuarioId);
    if (cuadrilla) {
      const miembros = await tx.tecnico.findMany({ where: { id: { in: cuadrilla.miembros.map((m) => m.tecnicoId) } } });
      destinatarios.push(...miembros.map((m) => m.usuarioId));
    }
    await notificarUsuarios(tx, destinatarios, {
      titulo: 'Nueva asignación',
      mensaje: `Se le asignó la orden ${orden.codigo}.`,
      enlace: `/tecnico/ordenes/${orden.id}`,
    });
    await auditar(tx, {
      usuarioId: actor.id, accion: 'ASIGNAR_ORDEN', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente,
      detalle: { tecnicoId: tecnico?.id || null, cuadrillaId: cuadrilla?.id || null },
    });
    return resultado;
  });
}

function asignacionDelTecnico(orden, tecnicoId) {
  return (orden.asignaciones || []).find((item) => item.estado === 'PENDIENTE' && (
    item.tecnicoId === tecnicoId
    || (item.cuadrillaId && orden.cuadrilla?.miembros?.some((m) => m.tecnicoId === tecnicoId))
  ));
}

export function aceptar(usuario, id, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.aceptar', async (tx) => {
    const orden = await cargar(tx, id);
    exigirVisible(usuario, orden);
    if (orden.estado === 'ACEPTADA' && orden.tecnicoId === usuario.tecnicoId) return presentar(orden);
    const asignacion = asignacionDelTecnico(orden, usuario.tecnicoId);
    if (!asignacion) throw new AppError(403, 'No tiene una asignación pendiente para esta orden', 'ASIGNACION');
    await tx.asignacion.update({
      where: { id: asignacion.id },
      data: { estado: 'ACEPTADA', fechaRespuesta: new Date(), respondidoPorId: usuario.tecnicoId },
    });
    await tx.ordenTrabajo.update({ where: { id }, data: { tecnicoId: usuario.tecnicoId } });
    const actualizada = await cargar(tx, id);
    const extra = {};
    if (new Date() > new Date(actualizada.slaRespuestaVenceEn)) extra.slaRespuestaIncumplido = true;
    const resultado = await transicionar(tx, actualizada, 'ACEPTADA', usuario.id, 'Asignación aceptada', extra);
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'ACEPTAR_ASIGNACION', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return resultado;
  });
}

export function rechazarAsignacion(usuario, id, motivo, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.rechazar', async (tx) => {
    const orden = await cargar(tx, id);
    exigirVisible(usuario, orden);
    const asignacion = asignacionDelTecnico(orden, usuario.tecnicoId);
    if (!asignacion) throw new AppError(403, 'No tiene una asignación pendiente para esta orden', 'ASIGNACION');
    await tx.asignacion.update({
      where: { id: asignacion.id },
      data: { estado: 'RECHAZADA', motivo, fechaRespuesta: new Date(), respondidoPorId: usuario.tecnicoId },
    });
    await tx.ordenTrabajo.update({ where: { id }, data: { tecnicoId: null, cuadrillaId: null } });
    const actualizada = await cargar(tx, id);
    const resultado = await transicionar(tx, actualizada, 'PENDIENTE', usuario.id, motivo, {});
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'RECHAZAR_ASIGNACION', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { motivo },
    });
    return resultado;
  });
}

export async function iniciar(usuario, id, contenido, ctx, clave) {
  const previa = clave ? await prisma.idempotencia.findUnique({ where: { clave } }) : null;
  if (previa?.usuarioId === usuario.id) return previa.cuerpo;
  const orden = await prisma.ordenTrabajo.findUnique({ where: { id }, include: includeDetalle });
  exigirEjecutor(usuario, orden);
  if (orden.estado === 'EN_PROCESO') return presentar(orden);
  if (!qrCoincide(orden.activo, contenido)) {
    await prisma.$transaction((tx) => auditar(tx, {
      usuarioId: usuario.id, accion: 'VALIDAR_QR', entidad: 'Activo', entidadId: orden.activoId,
      resultado: 'FALLO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId: id },
    }));
    throw new AppError(422, 'El código QR no corresponde al activo de la orden', 'QR_INVALIDO');
  }
  return conIdempotencia(usuario.id, clave, 'orden.iniciar', async (tx) => {
    const fresca = await cargar(tx, id);
    exigirEjecutor(usuario, fresca);
    if (fresca.estado === 'EN_PROCESO') return presentar(fresca);
    if (!qrCoincide(fresca.activo, contenido)) {
      throw new AppError(422, 'El código QR no corresponde al activo de la orden', 'QR_INVALIDO');
    }
    await cambiarEstadoActivo(tx, {
      activo: fresca.activo,
      estado: 'EN_MANTENIMIENTO',
      usuarioId: usuario.id,
      descripcion: `Trabajo iniciado en la orden ${fresca.codigo}`,
    });
    const extra = { fechaInicio: fresca.fechaInicio ?? new Date() };
    if (new Date() > new Date(fresca.slaRespuestaVenceEn)) extra.slaRespuestaIncumplido = true;
    const resultado = await transicionar(tx, fresca, 'EN_PROCESO', usuario.id, 'Trabajo iniciado tras validar el QR', extra);
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'VALIDAR_QR', entidad: 'Activo', entidadId: fresca.activoId,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId: id },
    });
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'INICIAR_ORDEN', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return resultado;
  });
}

function exigirProceso(orden) {
  if (orden.estado !== 'EN_PROCESO') {
    throw new AppError(409, 'La orden no está en proceso', 'TRANSICION');
  }
}

export function diagnostico(usuario, id, texto, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.diagnostico', async (tx) => {
    const orden = await cargar(tx, id);
    exigirEjecutor(usuario, orden);
    exigirProceso(orden);
    await tx.ordenTrabajo.update({ where: { id }, data: { diagnostico: texto } });
    await registrarHistorial(tx, {
      activoId: orden.activoId, tipo: 'DIAGNOSTICO', descripcion: texto,
      referenciaTipo: 'OrdenTrabajo', referenciaId: id, usuarioId: usuario.id,
    });
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'REGISTRAR_DIAGNOSTICO', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return presentar(await cargar(tx, id));
  });
}

export function solucion(usuario, id, texto, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.solucion', async (tx) => {
    const orden = await cargar(tx, id);
    exigirEjecutor(usuario, orden);
    exigirProceso(orden);
    await tx.ordenTrabajo.update({ where: { id }, data: { solucion: texto } });
    await registrarHistorial(tx, {
      activoId: orden.activoId, tipo: 'REPARACION', descripcion: texto,
      referenciaTipo: 'OrdenTrabajo', referenciaId: id, usuarioId: usuario.id,
    });
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'REGISTRAR_SOLUCION', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return presentar(await cargar(tx, id));
  });
}

export function registrarRepuestos(usuario, id, items, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.repuestos', async (tx) => {
    const orden = await cargar(tx, id);
    exigirEjecutor(usuario, orden);
    exigirProceso(orden);
    const movimientos = [];
    for (const item of items) {
      if (item.clientMutationId) {
        const previo = await tx.movimientoRepuesto.findUnique({ where: { clientMutationId: item.clientMutationId } });
        if (previo) {
          movimientos.push(previo);
          continue;
        }
      }
      const repuesto = await tx.repuesto.findUnique({ where: { id: item.repuestoId } });
      if (!repuesto || repuesto.estado !== 'ACTIVO') {
        throw new AppError(422, 'El repuesto no está disponible', 'REPUESTO');
      }
      const descuento = await tx.repuesto.updateMany({
        where: { id: repuesto.id, estado: 'ACTIVO', stock: { gte: item.cantidad } },
        data: { stock: { decrement: item.cantidad } },
      });
      if (descuento.count !== 1) {
        throw new AppError(409, `Stock insuficiente de ${repuesto.codigo}`, 'STOCK');
      }
      const fresco = await tx.repuesto.findUnique({ where: { id: repuesto.id } });
      const movimiento = await tx.movimientoRepuesto.create({
        data: {
          repuestoId: repuesto.id,
          tipo: 'CONSUMO',
          cantidad: item.cantidad,
          stockResultante: fresco.stock,
          ordenId: id,
          realizadoPorId: usuario.id,
          notas: item.notas || null,
          clientMutationId: item.clientMutationId || null,
        },
        include: { repuesto: { select: { codigo: true, nombre: true } } },
      });
      await registrarHistorial(tx, {
        activoId: orden.activoId,
        tipo: 'REPUESTO',
        descripcion: `Consumo de ${item.cantidad} × ${repuesto.codigo} en la orden ${orden.codigo}`,
        referenciaTipo: 'MovimientoRepuesto',
        referenciaId: movimiento.id,
        usuarioId: usuario.id,
      });
      await auditar(tx, {
        usuarioId: usuario.id, accion: 'CONSUMO_REPUESTO', entidad: 'Repuesto', entidadId: repuesto.id,
        resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente,
        detalle: { ordenId: id, cantidad: item.cantidad, stock: fresco.stock },
      });
      if (fresco.stock <= fresco.stockMinimo) {
        const bodega = await usuariosConPermiso(tx, 'movimientos.escribir');
        await notificarUsuarios(tx, bodega.map((u) => u.id), {
          titulo: 'Stock bajo',
          mensaje: `${repuesto.codigo} quedó en ${fresco.stock}, por debajo del mínimo.`,
          enlace: '/repuestos',
        });
      }
      movimientos.push(movimiento);
    }
    return movimientos;
  });
}

async function evidenciaMinima(tx) {
  const config = await tx.configuracion.findUnique({ where: { clave: 'evidencia_minima' } });
  const valor = Number(config?.valor ?? 1);
  return Number.isFinite(valor) ? valor : 1;
}

async function checklistEsObligatorio(tx) {
  const config = await tx.configuracion.findUnique({ where: { clave: 'checklist_obligatorio' } });
  return config?.valor !== false;
}

function validarCierre(orden, minimo, checklistObligatorio) {
  if (!orden.diagnostico || orden.diagnostico.trim().length < 10) {
    throw new AppError(422, 'Registre un diagnóstico antes de solicitar el cierre', 'CIERRE_INCOMPLETO');
  }
  if (!orden.solucion || orden.solucion.trim().length < 10) {
    throw new AppError(422, 'Registre la solución antes de solicitar el cierre', 'CIERRE_INCOMPLETO');
  }
  if ((orden.evidencias || []).length < minimo) {
    throw new AppError(422, 'Adjunte la evidencia mínima antes de solicitar el cierre', 'CIERRE_INCOMPLETO');
  }
  if (!checklistObligatorio) return;
  const checklist = orden.checklists?.[0];
  if (!checklist) throw new AppError(422, 'Complete el checklist antes de solicitar el cierre', 'CHECKLIST');
  for (const item of checklist.plantilla.items.filter((entrada) => entrada.obligatorio)) {
    const respuesta = checklist.respuestas.find((entrada) => entrada.itemId === item.id);
    if (!respuesta?.cumplida) {
      throw new AppError(422, `Falta la actividad obligatoria: ${item.texto}`, 'CHECKLIST');
    }
  }
}

export function solicitarCierre(usuario, id, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.cierre', async (tx) => {
    const orden = await cargar(tx, id);
    exigirEjecutor(usuario, orden);
    if (orden.estado === 'PENDIENTE_APROBACION') return presentar(orden);
    exigirProceso(orden);
    validarCierre(orden, await evidenciaMinima(tx), await checklistEsObligatorio(tx));
    await tx.aprobacion.create({
      data: { ordenId: id, solicitadoPorId: usuario.id, estado: 'PENDIENTE' },
    });
    const resultado = await transicionar(tx, orden, 'PENDIENTE_APROBACION', usuario.id, 'Cierre solicitado', {
      fechaSolicitudCierre: new Date(),
    });
    const supervisores = await usuariosConPermiso(tx, 'ordenes.aprobar');
    await notificarUsuarios(tx, supervisores.map((u) => u.id), {
      titulo: orden.prioridad === 'CRITICA' ? 'Cierre crítico por aprobar' : 'Cierre por aprobar',
      mensaje: `La orden ${orden.codigo} espera aprobación.`,
      enlace: `/ordenes/${orden.id}`,
    });
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'SOLICITAR_CIERRE', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { prioridad: orden.prioridad },
    });
    return resultado;
  });
}

async function consumirToken(tx, { token, ordenId, usuarioId, ctx }) {
  const registro = await tx.tokenOperacion.findUnique({ where: { tokenHash: sha256(token) } });
  const invalido = !registro
    || registro.ordenId !== ordenId
    || registro.proposito !== 'CIERRE_CRITICO'
    || registro.usuarioAutorizadoId !== usuarioId
    || registro.estado !== 'ACTIVO'
    || registro.expiraEn < new Date();
  if (invalido) {
    throw new AppError(422, 'El token de cierre crítico no es válido, expiró o fue revocado', 'TOKEN_INVALIDO');
  }
  await tx.tokenOperacion.update({
    where: { id: registro.id },
    data: { estado: 'UTILIZADO', usadoEn: new Date() },
  });
  await auditar(tx, {
    usuarioId, accion: 'USAR_TOKEN', entidad: 'TokenOperacion', entidadId: registro.id,
    resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { ordenId },
  });
  return registro;
}

async function cerrarActivo(tx, orden, usuarioId) {
  if (orden.incidenteId) {
    await tx.incidente.update({ where: { id: orden.incidenteId }, data: { estado: 'CERRADO' } });
  }
  const otrasOrdenes = await tx.ordenTrabajo.count({
    where: { activoId: orden.activoId, id: { not: orden.id }, estado: { in: ESTADOS_ABIERTOS } },
  });
  const incidentesAbiertos = await tx.incidente.count({
    where: { activoId: orden.activoId, estado: 'ABIERTO' },
  });
  let estado = 'OPERATIVO';
  if (otrasOrdenes > 0) estado = 'EN_MANTENIMIENTO';
  else if (incidentesAbiertos > 0) estado = 'CON_FALLA';
  await cambiarEstadoActivo(tx, {
    activo: orden.activo,
    estado,
    usuarioId,
    descripcion: `Cierre de la orden ${orden.codigo}`,
  });
  const mantenimiento = await tx.mantenimientoPreventivo.findFirst({ where: { ordenId: orden.id } });
  if (mantenimiento && mantenimiento.estado !== 'COMPLETADO') {
    await tx.mantenimientoPreventivo.update({
      where: { id: mantenimiento.id },
      data: { estado: 'COMPLETADO', fechaEjecucion: new Date() },
    });
    await tx.mantenimientoPreventivo.create({
      data: {
        activoId: mantenimiento.activoId,
        descripcion: mantenimiento.descripcion,
        frecuencia: mantenimiento.frecuencia,
        fechaProgramada: sumarFrecuencia(mantenimiento.fechaProgramada, mantenimiento.frecuencia),
        responsableId: mantenimiento.responsableId,
        estado: 'PROGRAMADO',
      },
    });
    await registrarHistorial(tx, {
      activoId: orden.activoId,
      tipo: 'MANTENIMIENTO',
      descripcion: `Mantenimiento preventivo completado desde la orden ${orden.codigo}`,
      referenciaTipo: 'MantenimientoPreventivo',
      referenciaId: mantenimiento.id,
      usuarioId,
    });
  }
}

export function aprobar(usuario, id, { observaciones, token }, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.aprobar', async (tx) => {
    const orden = await cargar(tx, id);
    if (orden.estado === 'FINALIZADA') return presentar(orden);
    if (orden.tecnico?.usuario?.id === usuario.id) {
      throw new AppError(403, 'No puede aprobar el cierre de su propia orden', 'AUTOAPROBACION');
    }
    const pendiente = orden.aprobaciones.find((item) => item.estado === 'PENDIENTE');
    if (pendiente?.solicitadoPorId === usuario.id) {
      throw new AppError(403, 'No puede aprobar un cierre que usted solicitó', 'AUTOAPROBACION');
    }
    let tokenUsado = null;
    if (orden.prioridad === 'CRITICA') {
      if (!token) throw new AppError(422, 'El cierre crítico requiere un token temporal', 'TOKEN_REQUERIDO');
      tokenUsado = await consumirToken(tx, { token, ordenId: id, usuarioId: usuario.id, ctx });
    }
    const extra = { fechaCierre: new Date() };
    if (new Date() > new Date(orden.slaResolucionVenceEn)) extra.slaResolucionIncumplido = true;
    if (pendiente) {
      await tx.aprobacion.update({
        where: { id: pendiente.id },
        data: {
          estado: 'APROBADA',
          revisadoPorId: usuario.id,
          revisadoEn: new Date(),
          observaciones: observaciones || null,
          tokenId: tokenUsado?.id || null,
        },
      });
    }
    const resultado = await transicionar(tx, orden, 'FINALIZADA', usuario.id, observaciones || 'Cierre aprobado', extra);
    await cerrarActivo(tx, orden, usuario.id);
    if (orden.tecnico?.usuario?.id) {
      await notificarUsuarios(tx, [orden.tecnico.usuario.id], {
        titulo: 'Cierre aprobado',
        mensaje: `La orden ${orden.codigo} fue finalizada.`,
        enlace: `/tecnico/ordenes/${orden.id}`,
      });
    }
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'APROBAR_CIERRE', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente,
      detalle: { slaResolucionIncumplido: Boolean(extra.slaResolucionIncumplido) },
    });
    return resultado;
  });
}

export function rechazarCierre(usuario, id, observaciones, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.rechazar-cierre', async (tx) => {
    const orden = await cargar(tx, id);
    if (orden.estado === 'RECHAZADA') return presentar(orden);
    const pendiente = orden.aprobaciones.find((item) => item.estado === 'PENDIENTE');
    if (pendiente?.solicitadoPorId === usuario.id) {
      throw new AppError(403, 'No puede rechazar un cierre que usted solicitó', 'AUTOAPROBACION');
    }
    if (pendiente) {
      await tx.aprobacion.update({
        where: { id: pendiente.id },
        data: { estado: 'RECHAZADA', revisadoPorId: usuario.id, revisadoEn: new Date(), observaciones },
      });
    }
    const resultado = await transicionar(tx, orden, 'RECHAZADA', usuario.id, observaciones, {});
    if (orden.tecnico?.usuario?.id) {
      await notificarUsuarios(tx, [orden.tecnico.usuario.id], {
        titulo: 'Cierre rechazado',
        mensaje: `La orden ${orden.codigo} fue devuelta: ${observaciones}`,
        enlace: `/tecnico/ordenes/${orden.id}`,
      });
    }
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'RECHAZAR_CIERRE', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: {},
    });
    return resultado;
  });
}

export function reanudar(usuario, id, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.reanudar', async (tx) => {
    const orden = await cargar(tx, id);
    exigirEjecutor(usuario, orden);
    if (orden.estado === 'EN_PROCESO') return presentar(orden);
    return transicionar(tx, orden, 'EN_PROCESO', usuario.id, 'Trabajo reanudado tras rechazo', {});
  });
}

export function cancelar(usuario, id, motivo, ctx, clave) {
  return conIdempotencia(usuario.id, clave, 'orden.cancelar', async (tx) => {
    const orden = await cargar(tx, id);
    if (orden.estado === 'CANCELADA') return presentar(orden);
    const resultado = await transicionar(tx, orden, 'CANCELADA', usuario.id, motivo, {});
    await auditar(tx, {
      usuarioId: usuario.id, accion: 'CANCELAR_ORDEN', entidad: 'OrdenTrabajo', entidadId: id,
      resultado: 'EXITO', ip: ctx.ip, agente: ctx.agente, detalle: { motivo },
    });
    return resultado;
  });
}

export { crearEn };
