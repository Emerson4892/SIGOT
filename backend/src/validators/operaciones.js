import { z } from 'zod';
import { correoSchema, esquemaId, esquemaLista, idParams, prioridadSchema, claveSchema } from './comun.js';

const vacio = { body: z.object({}).default({}), query: z.object({}).default({}), params: z.object({}).default({}) };

export const listarClientesSchema = esquemaLista();
export const clienteSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(160),
    nit: z.string().trim().max(30).optional().or(z.literal('')),
    correo: z.union([z.literal(''), z.string().trim().email()]).optional(),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),
    direccion: z.string().trim().max(240).optional().or(z.literal('')),
    activo: z.boolean().optional().default(true),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarClienteSchema = clienteSchema.extend({ params: idParams });

export const listarUbicacionesSchema = esquemaLista({
  clienteId: z.string().uuid().optional().or(z.literal('')),
});
export const ubicacionSchema = z.object({
  body: z.object({
    clienteId: z.string().uuid(),
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(160),
    direccion: z.string().trim().min(3).max(240),
    ciudad: z.string().trim().max(80).optional().or(z.literal('')),
    latitud: z.number().min(-90).max(90).nullable().optional(),
    longitud: z.number().min(-180).max(180).nullable().optional(),
    activo: z.boolean().optional().default(true),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarUbicacionSchema = ubicacionSchema.omit({ body: true }).extend({
  params: idParams,
  body: ubicacionSchema.shape.body.omit({ clienteId: true, codigo: true }),
});

export const tipoSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(120),
    descripcion: z.string().trim().max(400).optional().or(z.literal('')),
    activo: z.boolean().optional().default(true),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarTipoSchema = tipoSchema.extend({ params: idParams });

const estadoActivo = z.enum(['OPERATIVO', 'CON_FALLA', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'RETIRADO']);
export const listarActivosSchema = esquemaLista({
  estado: estadoActivo.optional().or(z.literal('')),
  clienteId: z.string().uuid().optional().or(z.literal('')),
});
export const activoSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(160),
    tipoActivoId: z.string().uuid(),
    marca: z.string().trim().max(80).optional().or(z.literal('')),
    modelo: z.string().trim().max(80).optional().or(z.literal('')),
    serie: z.string().trim().max(80).optional().or(z.literal('')),
    clienteId: z.string().uuid(),
    ubicacionId: z.string().uuid(),
    estado: estadoActivo.optional().default('OPERATIVO'),
    notas: z.string().trim().max(500).optional().or(z.literal('')),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarActivoSchema = activoSchema.extend({ params: idParams });
export const activoIdSchema = esquemaId();
export const validarQrSchema = z.object({
  body: z.object({
    ordenId: z.string().uuid(),
    contenido: z.string().trim().min(10).max(500),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const listarIncidentesSchema = esquemaLista({
  estado: z.enum(['ABIERTO', 'CONVERTIDO', 'CERRADO', 'CANCELADO']).optional().or(z.literal('')),
  prioridad: prioridadSchema.optional().or(z.literal('')),
});
export const incidenteSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    activoId: z.string().uuid(),
    descripcion: z.string().trim().min(10).max(2000),
    prioridad: prioridadSchema,
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarIncidenteSchema = z.object({
  body: z.object({
    descripcion: z.string().trim().min(10).max(2000),
    prioridad: prioridadSchema,
  }),
  query: z.object({}).default({}),
  params: idParams,
});

const estadosOrden = z.enum(['PENDIENTE', 'ASIGNADA', 'ACEPTADA', 'EN_PROCESO', 'PENDIENTE_APROBACION', 'FINALIZADA', 'RECHAZADA', 'CANCELADA']);
export const listarOrdenesSchema = esquemaLista({
  estado: estadosOrden.optional().or(z.literal('')),
  prioridad: prioridadSchema.optional().or(z.literal('')),
  vencidas: z.enum(['true', 'false', '']).optional().default(''),
  proximas: z.enum(['true', 'false', '']).optional().default(''),
});
export const ordenSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    activoId: z.string().uuid(),
    titulo: z.string().trim().min(3).max(160),
    descripcion: z.string().trim().min(10).max(4000),
    prioridad: prioridadSchema,
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const ordenIdSchema = esquemaId();
export const asignarSchema = z.object({
  body: z.object({
    tecnicoId: z.string().uuid().optional().nullable(),
    cuadrillaId: z.string().uuid().optional().nullable(),
    motivo: z.string().trim().max(300).optional().or(z.literal('')),
  }).refine((datos) => datos.tecnicoId || datos.cuadrillaId, { message: 'Indique técnico o cuadrilla' }),
  query: z.object({}).default({}),
  params: idParams,
});
export const motivoSchema = z.object({
  body: z.object({ motivo: z.string().trim().min(5).max(500) }),
  query: z.object({}).default({}),
  params: idParams,
});
export const iniciarSchema = z.object({
  body: z.object({ contenido: z.string().trim().min(10).max(500) }),
  query: z.object({}).default({}),
  params: idParams,
});
export const textoOrdenSchema = (campo) => z.object({
  body: z.object({ [campo]: z.string().trim().min(10).max(4000) }),
  query: z.object({}).default({}),
  params: idParams,
});
export const repuestosOrdenSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      repuestoId: z.string().uuid(),
      cantidad: z.number().int().positive(),
      notas: z.string().trim().max(300).optional().or(z.literal('')),
      clientMutationId: z.string().trim().max(80).optional(),
    })).min(1),
  }),
  query: z.object({}).default({}),
  params: idParams,
});
export const aprobarSchema = z.object({
  body: z.object({
    observaciones: z.string().trim().max(1000).optional().or(z.literal('')),
    token: z.string().trim().min(20).max(200).optional(),
  }),
  query: z.object({}).default({}),
  params: idParams,
});
export const observacionesSchema = z.object({
  body: z.object({ observaciones: z.string().trim().min(5).max(1000) }),
  query: z.object({}).default({}),
  params: idParams,
});

export const slaSchema = z.object({
  body: z.object({
    minutosRespuesta: z.number().int().positive(),
    minutosResolucion: z.number().int().positive(),
    activa: z.boolean().optional().default(true),
  }),
  query: z.object({}).default({}),
  params: z.object({ prioridad: prioridadSchema }),
});

export const listarTecnicosSchema = esquemaLista();
export const tecnicoSchema = z.object({
  body: z.object({
    correo: correoSchema,
    contrasena: claveSchema,
    nombre: z.string().trim().min(2).max(80),
    apellido: z.string().trim().min(2).max(80),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),
    codigoEmpleado: z.string().trim().max(40).optional().or(z.literal('')),
    especialidad: z.string().trim().max(120).optional().or(z.literal('')),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarTecnicoSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(2).max(80),
    apellido: z.string().trim().min(2).max(80),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),
    especialidad: z.string().trim().max(120).optional().or(z.literal('')),
    activo: z.boolean(),
  }),
  query: z.object({}).default({}),
  params: idParams,
});

export const cuadrillaSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(120),
    responsableId: z.string().uuid(),
    miembros: z.array(z.string().uuid()).default([]),
    activa: z.boolean().optional().default(true),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarCuadrillaSchema = cuadrillaSchema.extend({ params: idParams });

export const listarRepuestosSchema = esquemaLista({ bajoMinimo: z.enum(['true', 'false', '']).optional().default('') });
export const categoriaSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(2).max(80),
    descripcion: z.string().trim().max(240).optional().or(z.literal('')),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const repuestoSchema = z.object({
  body: z.object({
    codigo: z.string().trim().max(40).optional().or(z.literal('')),
    nombre: z.string().trim().min(2).max(160),
    descripcion: z.string().trim().max(400).optional().or(z.literal('')),
    categoriaId: z.string().uuid(),
    stock: z.number().int().min(0).optional().default(0),
    stockMinimo: z.number().int().min(0).optional().default(0),
    ubicacionAlmacen: z.string().trim().max(120).optional().or(z.literal('')),
    estado: z.enum(['ACTIVO', 'INACTIVO']).optional().default('ACTIVO'),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarRepuestoSchema = repuestoSchema.extend({ params: idParams });
export const listarMovimientosSchema = esquemaLista({
  repuestoId: z.string().uuid().optional().or(z.literal('')),
  ordenId: z.string().uuid().optional().or(z.literal('')),
  tipo: z.enum(['ENTRADA', 'SALIDA', 'ENTREGA', 'CONSUMO', 'DEVOLUCION']).optional().or(z.literal('')),
});
export const movimientoSchema = z.object({
  body: z.object({
    repuestoId: z.string().uuid(),
    tipo: z.enum(['ENTRADA', 'SALIDA', 'ENTREGA', 'DEVOLUCION']),
    cantidad: z.number().int().positive(),
    ordenId: z.string().uuid().optional().nullable(),
    notas: z.string().trim().max(300).optional().or(z.literal('')),
    clientMutationId: z.string().trim().max(80).optional(),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

const itemChecklist = z.object({
  texto: z.string().trim().min(3).max(240),
  obligatorio: z.boolean().optional().default(false),
  posicion: z.number().int().positive().optional(),
});
export const checklistSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(3).max(120),
    descripcion: z.string().trim().max(400).optional().or(z.literal('')),
    tipoActivoId: z.string().uuid().optional().nullable(),
    activa: z.boolean().optional().default(true),
    items: z.array(itemChecklist).min(1),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
export const editarChecklistSchema = checklistSchema.extend({ params: idParams });
export const completarChecklistSchema = z.object({
  body: z.object({
    plantillaId: z.string().uuid(),
    respuestas: z.array(z.object({
      itemId: z.string().uuid(),
      cumplida: z.boolean(),
      observacion: z.string().trim().max(400).optional().or(z.literal('')),
    })).min(1),
  }),
  query: z.object({}).default({}),
  params: idParams,
});

export const listarMantenimientosSchema = esquemaLista({
  estado: z.enum(['PROGRAMADO', 'ORDEN_GENERADA', 'COMPLETADO', 'CANCELADO']).optional().or(z.literal('')),
  activoId: z.string().uuid().optional().or(z.literal('')),
});
export const mantenimientoSchema = z.object({
  body: z.object({
    activoId: z.string().uuid(),
    descripcion: z.string().trim().min(5).max(1000),
    frecuencia: z.enum(['DIARIA', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']),
    fechaProgramada: z.string().refine((valor) => !Number.isNaN(Date.parse(valor)), 'Fecha inválida'),
    responsableId: z.string().uuid(),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const listarTokensSchema = esquemaLista({
  ordenId: z.string().uuid().optional().or(z.literal('')),
  estado: z.enum(['ACTIVO', 'UTILIZADO', 'EXPIRADO', 'REVOCADO', '']).optional().default(''),
});
export const emitirTokenSchema = z.object({
  body: z.object({
    ordenId: z.string().uuid(),
    usuarioAutorizadoId: z.string().uuid().optional(),
    minutos: z.number().int().min(5).max(120).default(30),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const reporteSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    desde: z.string().optional().or(z.literal('')),
    hasta: z.string().optional().or(z.literal('')),
    prioridad: prioridadSchema.optional().or(z.literal('')),
    clienteId: z.string().uuid().optional().or(z.literal('')),
    tipo: z.enum(['operativo', 'sla']).optional().default('operativo'),
  }),
});

export const listarAuditoriaSchema = esquemaLista({
  accion: z.string().trim().max(80).optional().default(''),
  entidad: z.string().trim().max(80).optional().default(''),
  resultado: z.enum(['EXITO', 'FALLO', '']).optional().default(''),
  desde: z.string().optional().or(z.literal('')),
  hasta: z.string().optional().or(z.literal('')),
});

export const configuracionSchema = z.object({
  body: z.object({
    evidencia_minima: z.number().int().positive().optional(),
    checklist_obligatorio: z.boolean().optional(),
    nombre_sistema: z.string().trim().min(2).max(80).optional(),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const syncSchema = z.object({
  body: z.object({
    operaciones: z.array(z.object({
      id: z.string().trim().min(8).max(80),
      tipo: z.enum(['DIAGNOSTICO', 'SOLUCION', 'CHECKLIST', 'REPUESTOS', 'SOLICITAR_CIERRE']),
      ordenId: z.string().uuid(),
      cuerpo: z.record(z.any()).optional().default({}),
    })).min(1).max(30),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const notificacionIdSchema = esquemaId();
export { vacio };
