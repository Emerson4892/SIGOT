import { Router } from 'express';
import * as op from '../controllers/operacionesController.js';
import { autenticar } from '../middlewares/auth.js';
import { exigirClaveActualizada, requireAnyPermission, requirePermission } from '../middlewares/authorize.js';
import { csrf } from '../middlewares/csrf.js';
import { subirArchivo } from '../middlewares/upload.js';
import { validar } from '../middlewares/validate.js';
import { esquemaId } from '../validators/comun.js';
import * as v from '../validators/operaciones.js';
import { permisos as listarPermisos } from '../controllers/rolController.js';
import authRoutes from './auth.routes.js';
import rolesRoutes from './roles.routes.js';
import usuariosRoutes from './usuarios.routes.js';

const router = Router();
const protegido = [autenticar, exigirClaveActualizada, csrf];

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/roles', rolesRoutes);

router.get('/permisos', ...protegido, requirePermission('permisos.leer'), listarPermisos);

function recurso(ruta, leer, escribir, listarSchema, crearSchema, editarSchema, handlers) {
  router.get(ruta, ...protegido, requirePermission(leer), validar(listarSchema), handlers.listar);
  router.post(ruta, ...protegido, requirePermission(escribir), validar(crearSchema), handlers.crear);
  router.patch(`${ruta}/:id`, ...protegido, requirePermission(escribir), validar(editarSchema), handlers.editar);
}

recurso('/clientes', 'clientes.leer', 'clientes.escribir', v.listarClientesSchema, v.clienteSchema, v.editarClienteSchema, {
  listar: op.listarClientes, crear: op.crearCliente, editar: op.editarCliente,
});
recurso('/ubicaciones', 'ubicaciones.leer', 'ubicaciones.escribir', v.listarUbicacionesSchema, v.ubicacionSchema, v.editarUbicacionSchema, {
  listar: op.listarUbicaciones, crear: op.crearUbicacion, editar: op.editarUbicacion,
});
recurso('/tipos-activo', 'tipos_activo.leer', 'tipos_activo.escribir', v.listarClientesSchema, v.tipoSchema, v.editarTipoSchema, {
  listar: op.listarTipos, crear: op.crearTipo, editar: op.editarTipo,
});

router.get('/activos', ...protegido, requirePermission('activos.leer'), validar(v.listarActivosSchema), op.listarActivos);
router.post('/activos', ...protegido, requirePermission('activos.escribir'), validar(v.activoSchema), op.crearActivo);
router.get('/activos/:id/qr', ...protegido, requirePermission('activos.leer'), validar(esquemaId()), op.imagenQr);
router.get('/activos/:id/qr-contenido', ...protegido, requirePermission('activos.leer'), validar(esquemaId()), op.contenidoQr);
router.get('/activos/:id/historial', ...protegido, requirePermission('historial.leer'), validar(esquemaId()), op.historialActivo);
router.get('/activos/:id', ...protegido, requirePermission('activos.leer'), validar(esquemaId()), op.obtenerActivo);
router.patch('/activos/:id', ...protegido, requirePermission('activos.escribir'), validar(v.editarActivoSchema), op.editarActivo);
router.post('/activos/validar-qr', ...protegido, requirePermission('qr.validar'), validar(v.validarQrSchema), op.validarQr);

router.get('/incidentes', ...protegido, requirePermission('incidentes.leer'), validar(v.listarIncidentesSchema), op.listarIncidentes);
router.post('/incidentes', ...protegido, requirePermission('incidentes.escribir'), validar(v.incidenteSchema), op.crearIncidente);
router.patch('/incidentes/:id', ...protegido, requirePermission('incidentes.escribir'), validar(v.editarIncidenteSchema), op.editarIncidente);
router.post('/incidentes/:id/convertir', ...protegido, requirePermission('ordenes.escribir'), validar(esquemaId()), op.convertirIncidente);
router.post('/incidentes/:id/cancelar', ...protegido, requirePermission('incidentes.escribir'), validar(esquemaId()), op.cancelarIncidente);

router.get('/ordenes/vencidas', ...protegido, requireAnyPermission('ordenes.leer', 'ordenes.leer_asignadas'), validar(v.listarOrdenesSchema), (req, res, next) => {
  req.valid.query.vencidas = 'true';
  return op.listarOrdenes(req, res, next);
});
router.get('/ordenes/proximas', ...protegido, requireAnyPermission('ordenes.leer', 'ordenes.leer_asignadas'), validar(v.listarOrdenesSchema), (req, res, next) => {
  req.valid.query.proximas = 'true';
  return op.listarOrdenes(req, res, next);
});
router.get('/ordenes', ...protegido, requireAnyPermission('ordenes.leer', 'ordenes.leer_asignadas'), validar(v.listarOrdenesSchema), op.listarOrdenes);
router.post('/ordenes', ...protegido, requirePermission('ordenes.escribir'), validar(v.ordenSchema), op.crearOrden);
router.get('/ordenes/:id/historial', ...protegido, requireAnyPermission('ordenes.leer', 'ordenes.leer_asignadas'), validar(esquemaId()), op.historialOrden);
router.get('/ordenes/:id', ...protegido, requireAnyPermission('ordenes.leer', 'ordenes.leer_asignadas'), validar(esquemaId()), op.obtenerOrden);
router.post('/ordenes/:id/asignar', ...protegido, requirePermission('ordenes.asignar'), validar(v.asignarSchema), op.asignarOrden);
router.post('/ordenes/:id/aceptar', ...protegido, requirePermission('ordenes.trabajar'), validar(esquemaId()), op.aceptarOrden);
router.post('/ordenes/:id/rechazar', ...protegido, requirePermission('ordenes.trabajar'), validar(v.motivoSchema), op.rechazarOrden);
router.post('/ordenes/:id/iniciar', ...protegido, requirePermission('ordenes.trabajar'), validar(v.iniciarSchema), op.iniciarOrden);
router.post('/ordenes/:id/diagnostico', ...protegido, requirePermission('ordenes.trabajar'), validar(v.textoOrdenSchema('diagnostico')), op.diagnosticoOrden);
router.post('/ordenes/:id/solucion', ...protegido, requirePermission('ordenes.trabajar'), validar(v.textoOrdenSchema('solucion')), op.solucionOrden);
router.post('/ordenes/:id/repuestos', ...protegido, requirePermission('ordenes.trabajar'), validar(v.repuestosOrdenSchema), op.repuestosOrden);
router.post('/ordenes/:id/checklist', ...protegido, requirePermission('checklists.completar'), validar(v.completarChecklistSchema), op.completarChecklist);
router.post('/ordenes/:id/evidencias', ...protegido, requirePermission('evidencias.escribir'), validar(esquemaId()), subirArchivo, op.subirEvidencia);
router.post('/ordenes/:id/solicitar-cierre', ...protegido, requirePermission('ordenes.trabajar'), validar(esquemaId()), op.solicitarCierre);
router.post('/ordenes/:id/aprobar', ...protegido, requirePermission('ordenes.aprobar'), validar(v.aprobarSchema), op.aprobarOrden);
router.post('/ordenes/:id/rechazar-cierre', ...protegido, requirePermission('ordenes.aprobar'), validar(v.observacionesSchema), op.rechazarCierre);
router.post('/ordenes/:id/reanudar', ...protegido, requirePermission('ordenes.trabajar'), validar(esquemaId()), op.reanudarOrden);
router.post('/ordenes/:id/cancelar', ...protegido, requirePermission('ordenes.cancelar'), validar(v.motivoSchema), op.cancelarOrden);

router.get('/sla', ...protegido, requirePermission('sla.leer'), op.listarSla);
router.put('/sla/:prioridad', ...protegido, requirePermission('sla.escribir'), validar(v.slaSchema), op.editarSla);

recurso('/tecnicos', 'tecnicos.leer', 'tecnicos.escribir', v.listarTecnicosSchema, v.tecnicoSchema, v.editarTecnicoSchema, {
  listar: op.listarTecnicos, crear: op.crearTecnico, editar: op.editarTecnico,
});
recurso('/cuadrillas', 'cuadrillas.leer', 'cuadrillas.escribir', v.listarTecnicosSchema, v.cuadrillaSchema, v.editarCuadrillaSchema, {
  listar: op.listarCuadrillas, crear: op.crearCuadrilla, editar: op.editarCuadrilla,
});

router.get('/repuestos/alertas', ...protegido, requirePermission('repuestos.leer'), op.alertasRepuestos);
router.get('/repuestos/categorias', ...protegido, requirePermission('repuestos.leer'), op.listarCategorias);
router.post('/repuestos/categorias', ...protegido, requirePermission('repuestos.escribir'), validar(v.categoriaSchema), op.crearCategoria);
router.get('/repuestos', ...protegido, requirePermission('repuestos.leer'), validar(v.listarRepuestosSchema), op.listarRepuestos);
router.post('/repuestos', ...protegido, requirePermission('repuestos.escribir'), validar(v.repuestoSchema), op.crearRepuesto);
router.patch('/repuestos/:id', ...protegido, requirePermission('repuestos.escribir'), validar(v.editarRepuestoSchema), op.editarRepuesto);

router.get('/movimientos', ...protegido, requirePermission('movimientos.leer'), validar(v.listarMovimientosSchema), op.listarMovimientos);
router.post('/movimientos', ...protegido, requirePermission('movimientos.escribir'), validar(v.movimientoSchema), op.crearMovimiento);

router.get('/checklists/plantillas', ...protegido, requirePermission('checklists.leer'), op.listarChecklists);
router.post('/checklists/plantillas', ...protegido, requirePermission('checklists.escribir'), validar(v.checklistSchema), op.crearChecklist);
router.patch('/checklists/plantillas/:id', ...protegido, requirePermission('checklists.escribir'), validar(v.editarChecklistSchema), op.editarChecklist);

router.get('/evidencias/:id/archivo', ...protegido, requireAnyPermission('evidencias.leer', 'evidencias.escribir'), validar(esquemaId()), op.descargarEvidencia);

router.get('/mantenimientos', ...protegido, requirePermission('mantenimientos.leer'), validar(v.listarMantenimientosSchema), op.listarMantenimientos);
router.post('/mantenimientos', ...protegido, requirePermission('mantenimientos.escribir'), validar(v.mantenimientoSchema), op.crearMantenimiento);
router.post('/mantenimientos/:id/generar-orden', ...protegido, requirePermission('mantenimientos.escribir'), validar(esquemaId()), op.generarMantenimiento);

router.get('/aprobaciones', ...protegido, requirePermission('aprobaciones.leer'), validar(v.listarOrdenesSchema), op.listarAprobaciones);
router.get('/tokens', ...protegido, requirePermission('tokens.leer'), validar(v.listarTokensSchema), op.listarTokens);
router.post('/tokens', ...protegido, requirePermission('tokens.escribir'), validar(v.emitirTokenSchema), op.emitirToken);
router.post('/tokens/:id/revocar', ...protegido, requirePermission('tokens.escribir'), validar(esquemaId()), op.revocarToken);

router.get('/dashboard', ...protegido, requirePermission('dashboard.leer'), op.dashboard);
router.get('/reportes/operativo', ...protegido, requirePermission('reportes.leer'), validar(v.reporteSchema), op.reporteOperativo);
router.get('/reportes/sla', ...protegido, requirePermission('reportes.leer'), validar(v.reporteSchema), op.reporteSla);
router.get('/reportes/exportar', ...protegido, requirePermission('reportes.exportar'), validar(v.reporteSchema), op.exportarReporte);

router.get('/auditoria/verificar', ...protegido, requirePermission('auditoria.leer'), op.verificarAuditoria);
router.get('/auditoria', ...protegido, requirePermission('auditoria.leer'), validar(v.listarAuditoriaSchema), op.listarAuditoria);

router.get('/notificaciones', ...protegido, op.listarNotificaciones);
router.post('/notificaciones/leer-todas', ...protegido, op.leerNotificaciones);
router.post('/notificaciones/:id/leida', ...protegido, validar(esquemaId()), op.leerNotificacion);

router.get('/configuracion', ...protegido, requirePermission('configuracion.leer'), op.verConfiguracion);
router.put('/configuracion', ...protegido, requirePermission('configuracion.escribir'), validar(v.configuracionSchema), op.editarConfiguracion);

router.post('/sync', ...protegido, requirePermission('ordenes.trabajar'), validar(v.syncSchema), op.sincronizar);
router.get('/tecnico/ordenes', ...protegido, requirePermission('ordenes.leer_asignadas'), validar(v.listarOrdenesSchema), op.listarOrdenes);

export default router;
