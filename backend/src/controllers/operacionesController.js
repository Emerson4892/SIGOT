import * as activoService from '../services/activoService.js';
import * as auditoriaService from '../services/auditoriaService.js';
import * as checklistService from '../services/checklistService.js';
import * as clienteService from '../services/clienteService.js';
import * as configuracionService from '../services/configuracionService.js';
import * as cuadrillaService from '../services/cuadrillaService.js';
import * as dashboardService from '../services/dashboardService.js';
import * as evidenciaService from '../services/evidenciaService.js';
import * as incidenteService from '../services/incidenteService.js';
import * as mantenimientoService from '../services/mantenimientoService.js';
import * as movimientoService from '../services/movimientoService.js';
import * as notificacionService from '../services/notificacionService.js';
import * as ordenService from '../services/ordenService.js';
import * as reporteService from '../services/reporteService.js';
import * as repuestoService from '../services/repuestoService.js';
import * as slaService from '../services/slaService.js';
import * as syncService from '../services/syncService.js';
import * as tecnicoService from '../services/tecnicoService.js';
import * as tipoActivoService from '../services/tipoActivoService.js';
import * as tokenService from '../services/tokenService.js';
import * as ubicacionService from '../services/ubicacionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { contexto, claveIdempotencia } from '../utils/http.js';

const creado = (servicio) => asyncHandler(async (req, res) => {
  res.status(201).json(await servicio(req.user, req.valid.body, contexto(req)));
});
const listado = (servicio) => asyncHandler(async (req, res) => {
  res.json(await servicio(req.valid.query));
});
const editado = (servicio) => asyncHandler(async (req, res) => {
  res.json(await servicio(req.user, req.valid.params.id, req.valid.body, contexto(req)));
});

export const listarClientes = listado(clienteService.listar);
export const crearCliente = creado(clienteService.crear);
export const editarCliente = editado(clienteService.actualizar);
export const listarUbicaciones = listado(ubicacionService.listar);
export const crearUbicacion = creado(ubicacionService.crear);
export const editarUbicacion = editado(ubicacionService.actualizar);
export const listarTipos = listado(tipoActivoService.listar);
export const crearTipo = creado(tipoActivoService.crear);
export const editarTipo = editado(tipoActivoService.actualizar);

export const listarActivos = listado(activoService.listar);
export const obtenerActivo = asyncHandler(async (req, res) => {
  res.json(await activoService.obtener(req.valid.params.id));
});
export const crearActivo = creado(activoService.crear);
export const editarActivo = editado(activoService.actualizar);
export const contenidoQr = asyncHandler(async (req, res) => {
  res.json(await activoService.contenido(req.valid.params.id));
});
export const imagenQr = asyncHandler(async (req, res) => {
  const buffer = await activoService.imagenQr(req.valid.params.id);
  res.setHeader('Content-Type', 'image/png');
  res.send(buffer);
});
export const validarQr = asyncHandler(async (req, res) => {
  res.json(await activoService.validarContraOrden(req.user, req.valid.body, contexto(req)));
});
export const historialActivo = asyncHandler(async (req, res) => {
  res.json({ datos: await activoService.historial(req.user, req.valid.params.id) });
});

export const listarIncidentes = listado(incidenteService.listar);
export const crearIncidente = creado(incidenteService.crear);
export const editarIncidente = editado(incidenteService.actualizar);
export const convertirIncidente = asyncHandler(async (req, res) => {
  res.status(201).json(await incidenteService.convertir(req.user, req.valid.params.id, contexto(req)));
});
export const cancelarIncidente = asyncHandler(async (req, res) => {
  res.json(await incidenteService.cancelar(req.user, req.valid.params.id, contexto(req)));
});

export const listarOrdenes = asyncHandler(async (req, res) => {
  res.json(await ordenService.listar(req.user, req.valid.query));
});
export const crearOrden = asyncHandler(async (req, res) => {
  res.status(201).json(await ordenService.crear(req.user, req.valid.body, contexto(req), claveIdempotencia(req)));
});
export const obtenerOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.obtener(req.user, req.valid.params.id));
});
export const historialOrden = asyncHandler(async (req, res) => {
  res.json({ datos: await ordenService.historial(req.user, req.valid.params.id) });
});
export const asignarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.asignar(req.user, req.valid.params.id, req.valid.body, contexto(req), claveIdempotencia(req)));
});
export const aceptarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.aceptar(req.user, req.valid.params.id, contexto(req), claveIdempotencia(req)));
});
export const rechazarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.rechazarAsignacion(req.user, req.valid.params.id, req.valid.body.motivo, contexto(req), claveIdempotencia(req)));
});
export const iniciarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.iniciar(req.user, req.valid.params.id, req.valid.body.contenido, contexto(req), claveIdempotencia(req)));
});
export const diagnosticoOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.diagnostico(req.user, req.valid.params.id, req.valid.body.diagnostico, contexto(req), claveIdempotencia(req)));
});
export const solucionOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.solucion(req.user, req.valid.params.id, req.valid.body.solucion, contexto(req), claveIdempotencia(req)));
});
export const repuestosOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.registrarRepuestos(req.user, req.valid.params.id, req.valid.body.items, contexto(req), claveIdempotencia(req)));
});
export const solicitarCierre = asyncHandler(async (req, res) => {
  res.json(await ordenService.solicitarCierre(req.user, req.valid.params.id, contexto(req), claveIdempotencia(req)));
});
export const aprobarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.aprobar(req.user, req.valid.params.id, req.valid.body, contexto(req), claveIdempotencia(req)));
});
export const rechazarCierre = asyncHandler(async (req, res) => {
  res.json(await ordenService.rechazarCierre(req.user, req.valid.params.id, req.valid.body.observaciones, contexto(req), claveIdempotencia(req)));
});
export const reanudarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.reanudar(req.user, req.valid.params.id, contexto(req), claveIdempotencia(req)));
});
export const cancelarOrden = asyncHandler(async (req, res) => {
  res.json(await ordenService.cancelar(req.user, req.valid.params.id, req.valid.body.motivo, contexto(req), claveIdempotencia(req)));
});

export const listarSla = asyncHandler(async (_req, res) => res.json({ datos: await slaService.listar() }));
export const editarSla = asyncHandler(async (req, res) => {
  res.json(await slaService.actualizar(req.user, req.valid.params.prioridad, req.valid.body, contexto(req)));
});

export const listarTecnicos = listado(tecnicoService.listar);
export const crearTecnico = creado(tecnicoService.crear);
export const editarTecnico = editado(tecnicoService.actualizar);
export const listarCuadrillas = listado(cuadrillaService.listar);
export const crearCuadrilla = creado(cuadrillaService.crear);
export const editarCuadrilla = editado(cuadrillaService.actualizar);

export const listarRepuestos = listado(repuestoService.listar);
export const alertasRepuestos = asyncHandler(async (_req, res) => res.json({ datos: await repuestoService.alertas() }));
export const listarCategorias = asyncHandler(async (_req, res) => res.json({ datos: await repuestoService.categorias() }));
export const crearCategoria = creado(repuestoService.crearCategoria);
export const crearRepuesto = creado(repuestoService.crear);
export const editarRepuesto = editado(repuestoService.actualizar);
export const listarMovimientos = listado(movimientoService.listar);
export const crearMovimiento = asyncHandler(async (req, res) => {
  res.status(201).json(await movimientoService.registrar(req.user, req.valid.body, contexto(req), claveIdempotencia(req)));
});

export const listarChecklists = asyncHandler(async (_req, res) => res.json({ datos: await checklistService.listar() }));
export const crearChecklist = creado(checklistService.crear);
export const editarChecklist = editado(checklistService.actualizar);
export const completarChecklist = asyncHandler(async (req, res) => {
  res.json(await checklistService.completar(req.user, req.valid.params.id, req.valid.body, contexto(req), claveIdempotencia(req)));
});

export const subirEvidencia = asyncHandler(async (req, res) => {
  res.status(201).json(await evidenciaService.adjuntar(req.user, req.valid.params.id, req.file, contexto(req), claveIdempotencia(req)));
});
export const descargarEvidencia = asyncHandler(async (req, res) => {
  const { evidencia, buffer } = await evidenciaService.obtenerArchivo(req.user, req.valid.params.id);
  res.setHeader('Content-Type', evidencia.mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidencia.nombreOriginal)}"`);
  res.send(buffer);
});

export const listarMantenimientos = listado(mantenimientoService.listar);
export const crearMantenimiento = creado(mantenimientoService.crear);
export const generarMantenimiento = asyncHandler(async (req, res) => {
  res.status(201).json(await mantenimientoService.generarOrden(req.user, req.valid.params.id, contexto(req)));
});

export const listarTokens = listado(tokenService.listar);
export const emitirToken = asyncHandler(async (req, res) => {
  res.status(201).json(await tokenService.emitir(req.user, req.valid.body, contexto(req)));
});
export const revocarToken = asyncHandler(async (req, res) => {
  res.json(await tokenService.revocar(req.user, req.valid.params.id, contexto(req)));
});

export const listarAprobaciones = asyncHandler(async (req, res) => {
  const consulta = { ...req.valid.query, estado: req.valid.query.estado || 'PENDIENTE_APROBACION' };
  res.json(await ordenService.listar(req.user, consulta));
});

export const dashboard = asyncHandler(async (_req, res) => res.json(await dashboardService.resumen()));
export const reporteOperativo = asyncHandler(async (req, res) => {
  res.json({ datos: await reporteService.operativo(req.valid.query) });
});
export const reporteSla = asyncHandler(async (req, res) => res.json(await reporteService.sla(req.valid.query)));
export const exportarReporte = asyncHandler(async (req, res) => {
  const archivo = await reporteService.exportar(req.valid.query.tipo || 'operativo', req.valid.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombre}"`);
  res.send(archivo.contenido);
});

export const listarAuditoria = listado(auditoriaService.listar);
export const verificarAuditoria = asyncHandler(async (_req, res) => res.json(await auditoriaService.verificar()));
export const listarNotificaciones = asyncHandler(async (req, res) => res.json(await notificacionService.listar(req.user.id)));
export const leerNotificacion = asyncHandler(async (req, res) => {
  await notificacionService.marcarLeida(req.user.id, req.valid.params.id);
  res.json({ mensaje: 'Notificación leída' });
});
export const leerNotificaciones = asyncHandler(async (req, res) => {
  await notificacionService.marcarTodas(req.user.id);
  res.json({ mensaje: 'Notificaciones leídas' });
});
export const verConfiguracion = asyncHandler(async (_req, res) => res.json({ datos: await configuracionService.obtener() }));
export const editarConfiguracion = asyncHandler(async (req, res) => {
  res.json({ datos: await configuracionService.actualizar(req.user, req.valid.body, contexto(req)) });
});
export const sincronizar = asyncHandler(async (req, res) => {
  res.json(await syncService.sincronizar(req.user, req.valid.body.operaciones, contexto(req)));
});
