-- CreateEnum
CREATE TYPE "EstadoActivo" AS ENUM ('OPERATIVO', 'CON_FALLA', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoIncidente" AS ENUM ('ABIERTO', 'CONVERTIDO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('PENDIENTE', 'ASIGNADA', 'ACEPTADA', 'EN_PROCESO', 'PENDIENTE_APROBACION', 'FINALIZADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigenOrden" AS ENUM ('CORRECTIVO', 'PREVENTIVO');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REASIGNADA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'ENTREGA', 'CONSUMO', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "EstadoRepuesto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "FrecuenciaMantenimiento" AS ENUM ('DIARIA', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoMantenimiento" AS ENUM ('PROGRAMADO', 'ORDEN_GENERADA', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoToken" AS ENUM ('ACTIVO', 'UTILIZADO', 'EXPIRADO', 'REVOCADO');

-- CreateEnum
CREATE TYPE "PropositoToken" AS ENUM ('CIERRE_CRITICO');

-- CreateEnum
CREATE TYPE "ResultadoAuditoria" AS ENUM ('EXITO', 'FALLO');

-- CreateEnum
CREATE TYPE "RolCuadrilla" AS ENUM ('RESPONSABLE', 'MIEMBRO');

-- CreateEnum
CREATE TYPE "TipoHistorialActivo" AS ENUM ('INCIDENTE', 'ORDEN', 'REPARACION', 'REPUESTO', 'DIAGNOSTICO', 'EVIDENCIA', 'CAMBIO_ESTADO', 'MANTENIMIENTO', 'QR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasenaHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "debeCambiarClave" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_roles" (
    "usuarioId" UUID NOT NULL,
    "rolId" UUID NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuarioId","rolId")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rolId" UUID NOT NULL,
    "permisoId" UUID NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "agente" TEXT,
    "ip" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacion" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "correo" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_activo" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_activo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoActivoId" UUID NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "serie" TEXT,
    "clienteId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "estado" "EstadoActivo" NOT NULL DEFAULT 'OPERATIVO',
    "qrSecreto" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "activoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL,
    "estado" "EstadoIncidente" NOT NULL DEFAULT 'ABIERTO',
    "reportadoPorId" UUID NOT NULL,
    "fechaReporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "incidenteId" UUID,
    "activoId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL,
    "origen" "OrigenOrden" NOT NULL DEFAULT 'CORRECTIVO',
    "estado" "EstadoOrden" NOT NULL DEFAULT 'PENDIENTE',
    "slaRespuestaVenceEn" TIMESTAMP(3) NOT NULL,
    "slaResolucionVenceEn" TIMESTAMP(3) NOT NULL,
    "slaRespuestaIncumplido" BOOLEAN NOT NULL DEFAULT false,
    "slaResolucionIncumplido" BOOLEAN NOT NULL DEFAULT false,
    "abiertaPorId" UUID NOT NULL,
    "tecnicoId" UUID,
    "cuadrillaId" UUID,
    "diagnostico" TEXT,
    "solucion" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaSolicitudCierre" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_estados_orden" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "estadoAnterior" "EstadoOrden",
    "estadoNuevo" "EstadoOrden" NOT NULL,
    "motivo" TEXT,
    "cambiadoPorId" UUID NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estados_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_sla" (
    "id" UUID NOT NULL,
    "prioridad" "Prioridad" NOT NULL,
    "minutosRespuesta" INTEGER NOT NULL,
    "minutosResolucion" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicas_sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tecnicos" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "codigoEmpleado" TEXT NOT NULL,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuadrillas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "responsableId" UUID NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuadrillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuadrilla_miembros" (
    "cuadrillaId" UUID NOT NULL,
    "tecnicoId" UUID NOT NULL,
    "rol" "RolCuadrilla" NOT NULL DEFAULT 'MIEMBRO',

    CONSTRAINT "cuadrilla_miembros_pkey" PRIMARY KEY ("cuadrillaId","tecnicoId")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "tecnicoId" UUID,
    "cuadrillaId" UUID,
    "asignadoPorId" UUID NOT NULL,
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRespuesta" TIMESTAMP(3),
    "respondidoPorId" UUID,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_repuesto" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "categorias_repuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" UUID NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "ubicacionAlmacen" TEXT,
    "estado" "EstadoRepuesto" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_repuesto" (
    "id" UUID NOT NULL,
    "repuestoId" UUID NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockResultante" INTEGER NOT NULL,
    "ordenId" UUID,
    "realizadoPorId" UUID NOT NULL,
    "notas" TEXT,
    "clientMutationId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_repuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_checklist" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoActivoId" UUID,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_plantilla" (
    "id" UUID NOT NULL,
    "plantillaId" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "posicion" INTEGER NOT NULL,

    CONSTRAINT "items_plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists_orden" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "plantillaId" UUID NOT NULL,
    "tecnicoId" UUID,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadoEn" TIMESTAMP(3),

    CONSTRAINT "checklists_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas_checklist" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "cumplida" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,

    CONSTRAINT "respuestas_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "nombreAlmacenado" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidaPorId" UUID NOT NULL,
    "clientMutationId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimientos_preventivos" (
    "id" UUID NOT NULL,
    "activoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "frecuencia" "FrecuenciaMantenimiento" NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaEjecucion" TIMESTAMP(3),
    "responsableId" UUID NOT NULL,
    "estado" "EstadoMantenimiento" NOT NULL DEFAULT 'PROGRAMADO',
    "ordenId" UUID,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mantenimientos_preventivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprobaciones" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "solicitadoPorId" UUID NOT NULL,
    "revisadoPorId" UUID,
    "estado" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "tokenId" UUID,
    "solicitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadoEn" TIMESTAMP(3),

    CONSTRAINT "aprobaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_operacion" (
    "id" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "proposito" "PropositoToken" NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoToken" NOT NULL DEFAULT 'ACTIVO',
    "usuarioAutorizadoId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creadoPorId" UUID NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_operacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_activos" (
    "id" UUID NOT NULL,
    "activoId" UUID NOT NULL,
    "tipo" "TipoHistorialActivo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "usuarioId" UUID,
    "detalle" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "usuarioId" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "resultado" "ResultadoAuditoria" NOT NULL,
    "ip" TEXT,
    "agente" TEXT,
    "detalle" JSONB,
    "hashPrevio" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "secuencias" (
    "nombre" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secuencias_pkey" PRIMARY KEY ("nombre")
);

-- CreateTable
CREATE TABLE "idempotencia" (
    "clave" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "ruta" TEXT NOT NULL,
    "estado" INTEGER NOT NULL,
    "cuerpo" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotencia_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_activo_idx" ON "usuarios"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_refreshHash_key" ON "sesiones"("refreshHash");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_idx" ON "sesiones"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_tokenHash_key" ON "tokens_recuperacion"("tokenHash");

-- CreateIndex
CREATE INDEX "tokens_recuperacion_usuarioId_idx" ON "tokens_recuperacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_key" ON "clientes"("codigo");

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes"("nombre");

-- CreateIndex
CREATE INDEX "ubicaciones_clienteId_idx" ON "ubicaciones"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_clienteId_codigo_key" ON "ubicaciones"("clienteId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_activo_codigo_key" ON "tipos_activo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "activos_codigo_key" ON "activos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "activos_serie_key" ON "activos"("serie");

-- CreateIndex
CREATE UNIQUE INDEX "activos_qrSecreto_key" ON "activos"("qrSecreto");

-- CreateIndex
CREATE INDEX "activos_clienteId_idx" ON "activos"("clienteId");

-- CreateIndex
CREATE INDEX "activos_ubicacionId_idx" ON "activos"("ubicacionId");

-- CreateIndex
CREATE INDEX "activos_estado_idx" ON "activos"("estado");

-- CreateIndex
CREATE INDEX "activos_tipoActivoId_idx" ON "activos"("tipoActivoId");

-- CreateIndex
CREATE UNIQUE INDEX "incidentes_codigo_key" ON "incidentes"("codigo");

-- CreateIndex
CREATE INDEX "incidentes_activoId_idx" ON "incidentes"("activoId");

-- CreateIndex
CREATE INDEX "incidentes_estado_idx" ON "incidentes"("estado");

-- CreateIndex
CREATE INDEX "incidentes_prioridad_idx" ON "incidentes"("prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_codigo_key" ON "ordenes_trabajo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_incidenteId_key" ON "ordenes_trabajo"("incidenteId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_estado_idx" ON "ordenes_trabajo"("estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_prioridad_idx" ON "ordenes_trabajo"("prioridad");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_activoId_idx" ON "ordenes_trabajo"("activoId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tecnicoId_idx" ON "ordenes_trabajo"("tecnicoId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_cuadrillaId_idx" ON "ordenes_trabajo"("cuadrillaId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_slaResolucionVenceEn_idx" ON "ordenes_trabajo"("slaResolucionVenceEn");

-- CreateIndex
CREATE INDEX "historial_estados_orden_ordenId_idx" ON "historial_estados_orden"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_sla_prioridad_key" ON "politicas_sla"("prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_usuarioId_key" ON "tecnicos"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_codigoEmpleado_key" ON "tecnicos"("codigoEmpleado");

-- CreateIndex
CREATE UNIQUE INDEX "cuadrillas_codigo_key" ON "cuadrillas"("codigo");

-- CreateIndex
CREATE INDEX "asignaciones_ordenId_idx" ON "asignaciones"("ordenId");

-- CreateIndex
CREATE INDEX "asignaciones_tecnicoId_idx" ON "asignaciones"("tecnicoId");

-- CreateIndex
CREATE INDEX "asignaciones_cuadrillaId_idx" ON "asignaciones"("cuadrillaId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_repuesto_nombre_key" ON "categorias_repuesto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "repuestos_codigo_key" ON "repuestos"("codigo");

-- CreateIndex
CREATE INDEX "repuestos_categoriaId_idx" ON "repuestos"("categoriaId");

-- CreateIndex
CREATE INDEX "repuestos_estado_idx" ON "repuestos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_repuesto_clientMutationId_key" ON "movimientos_repuesto"("clientMutationId");

-- CreateIndex
CREATE INDEX "movimientos_repuesto_repuestoId_idx" ON "movimientos_repuesto"("repuestoId");

-- CreateIndex
CREATE INDEX "movimientos_repuesto_ordenId_idx" ON "movimientos_repuesto"("ordenId");

-- CreateIndex
CREATE INDEX "movimientos_repuesto_tipo_idx" ON "movimientos_repuesto"("tipo");

-- CreateIndex
CREATE INDEX "items_plantilla_plantillaId_idx" ON "items_plantilla"("plantillaId");

-- CreateIndex
CREATE INDEX "checklists_orden_ordenId_idx" ON "checklists_orden"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "checklists_orden_ordenId_plantillaId_key" ON "checklists_orden"("ordenId", "plantillaId");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_checklist_checklistId_itemId_key" ON "respuestas_checklist"("checklistId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "evidencias_clientMutationId_key" ON "evidencias"("clientMutationId");

-- CreateIndex
CREATE INDEX "evidencias_ordenId_idx" ON "evidencias"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "mantenimientos_preventivos_ordenId_key" ON "mantenimientos_preventivos"("ordenId");

-- CreateIndex
CREATE INDEX "mantenimientos_preventivos_activoId_idx" ON "mantenimientos_preventivos"("activoId");

-- CreateIndex
CREATE INDEX "mantenimientos_preventivos_estado_idx" ON "mantenimientos_preventivos"("estado");

-- CreateIndex
CREATE INDEX "mantenimientos_preventivos_fechaProgramada_idx" ON "mantenimientos_preventivos"("fechaProgramada");

-- CreateIndex
CREATE UNIQUE INDEX "aprobaciones_tokenId_key" ON "aprobaciones"("tokenId");

-- CreateIndex
CREATE INDEX "aprobaciones_ordenId_idx" ON "aprobaciones"("ordenId");

-- CreateIndex
CREATE INDEX "aprobaciones_estado_idx" ON "aprobaciones"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_operacion_tokenHash_key" ON "tokens_operacion"("tokenHash");

-- CreateIndex
CREATE INDEX "tokens_operacion_ordenId_idx" ON "tokens_operacion"("ordenId");

-- CreateIndex
CREATE INDEX "tokens_operacion_estado_idx" ON "tokens_operacion"("estado");

-- CreateIndex
CREATE INDEX "historial_activos_activoId_creadoEn_idx" ON "historial_activos"("activoId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "auditoria_secuencia_key" ON "auditoria"("secuencia");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_idx" ON "auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidadId_idx" ON "auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "auditoria_accion_idx" ON "auditoria"("accion");

-- CreateIndex
CREATE INDEX "auditoria_creadoEn_idx" ON "auditoria"("creadoEn");

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_leida_idx" ON "notificaciones"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "idempotencia_usuarioId_idx" ON "idempotencia"("usuarioId");

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_tipoActivoId_fkey" FOREIGN KEY ("tipoActivoId") REFERENCES "tipos_activo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "incidentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_cuadrillaId_fkey" FOREIGN KEY ("cuadrillaId") REFERENCES "cuadrillas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_orden" ADD CONSTRAINT "historial_estados_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_orden" ADD CONSTRAINT "historial_estados_orden_cambiadoPorId_fkey" FOREIGN KEY ("cambiadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tecnicos" ADD CONSTRAINT "tecnicos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadrillas" ADD CONSTRAINT "cuadrillas_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "tecnicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadrilla_miembros" ADD CONSTRAINT "cuadrilla_miembros_cuadrillaId_fkey" FOREIGN KEY ("cuadrillaId") REFERENCES "cuadrillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadrilla_miembros" ADD CONSTRAINT "cuadrilla_miembros_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_cuadrillaId_fkey" FOREIGN KEY ("cuadrillaId") REFERENCES "cuadrillas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos" ADD CONSTRAINT "repuestos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_repuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_repuesto" ADD CONSTRAINT "movimientos_repuesto_repuestoId_fkey" FOREIGN KEY ("repuestoId") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_repuesto" ADD CONSTRAINT "movimientos_repuesto_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_repuesto" ADD CONSTRAINT "movimientos_repuesto_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_checklist" ADD CONSTRAINT "plantillas_checklist_tipoActivoId_fkey" FOREIGN KEY ("tipoActivoId") REFERENCES "tipos_activo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_plantilla" ADD CONSTRAINT "items_plantilla_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_orden" ADD CONSTRAINT "checklists_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_orden" ADD CONSTRAINT "checklists_orden_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_orden" ADD CONSTRAINT "checklists_orden_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_checklist" ADD CONSTRAINT "respuestas_checklist_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "checklists_orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_checklist" ADD CONSTRAINT "respuestas_checklist_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items_plantilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_subidaPorId_fkey" FOREIGN KEY ("subidaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_preventivos" ADD CONSTRAINT "mantenimientos_preventivos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_preventivos" ADD CONSTRAINT "mantenimientos_preventivos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "tecnicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_preventivos" ADD CONSTRAINT "mantenimientos_preventivos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens_operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_operacion" ADD CONSTRAINT "tokens_operacion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_operacion" ADD CONSTRAINT "tokens_operacion_usuarioAutorizadoId_fkey" FOREIGN KEY ("usuarioAutorizadoId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_operacion" ADD CONSTRAINT "tokens_operacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_activos" ADD CONSTRAINT "historial_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_activos" ADD CONSTRAINT "historial_activos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotencia" ADD CONSTRAINT "idempotencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
