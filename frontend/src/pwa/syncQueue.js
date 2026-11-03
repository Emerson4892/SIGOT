export const TIPOS_OFFLINE = ['DIAGNOSTICO', 'SOLUCION', 'CHECKLIST', 'REPUESTOS', 'EVIDENCIA', 'SOLICITAR_CIERRE'];

export const TIPOS_UNICOS = ['DIAGNOSTICO', 'SOLUCION', 'CHECKLIST', 'SOLICITAR_CIERRE'];

export const PREVIAS_CIERRE = ['CHECKLIST', 'DIAGNOSTICO', 'SOLUCION', 'EVIDENCIA'];

export const MAX_INTENTOS = 8;

const PRIORIDAD = {
  CHECKLIST: 1,
  DIAGNOSTICO: 2,
  SOLUCION: 3,
  REPUESTOS: 4,
  EVIDENCIA: 5,
  SOLICITAR_CIERRE: 6,
};

const CONFLICTOS = new Set(['CONCURRENCIA', 'STOCK', 'IDEMPOTENCIA', 'TRANSICION', 'DUPLICADO', 'ASIGNACION']);
const REINTENTOS = new Set(['ERROR', 'ERROR_INTERNO', 'RED', 'CONCURRENCIA']);

export function crearOperacion({ tipo, ordenId, cuerpo = null, usuarioId }) {
  if (!TIPOS_OFFLINE.includes(tipo)) {
    throw new Error('Esta operación debe confirmarse con el servidor');
  }
  if (!usuarioId) {
    throw new Error('La operación offline debe asociarse al técnico autenticado');
  }
  return {
    id: crypto.randomUUID(),
    tipo,
    ordenId,
    usuarioId,
    cuerpo: cuerpo ?? {},
    creadoEn: new Date().toISOString(),
    intentos: 0,
    error: null,
    codigo: null,
    estado: 'pendiente',
    proximoIntento: null,
  };
}

export function deduplicar(operaciones) {
  const vistos = new Set();
  return operaciones.filter((operacion) => {
    if (!operacion?.id || vistos.has(operacion.id)) return false;
    vistos.add(operacion.id);
    return true;
  });
}

export function compactar(operaciones) {
  const ordenadas = [...deduplicar(operaciones)].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
  const vistos = new Set();
  const conservar = [];
  const descartar = [];
  for (const operacion of ordenadas) {
    if (!TIPOS_UNICOS.includes(operacion.tipo)) {
      conservar.push(operacion);
      continue;
    }
    const clave = `${operacion.usuarioId}|${operacion.ordenId}|${operacion.tipo}`;
    if (vistos.has(clave)) descartar.push(operacion);
    else {
      vistos.add(clave);
      conservar.push(operacion);
    }
  }
  return { conservar, descartar };
}

export function ordenarOperaciones(operaciones) {
  return [...operaciones].sort((a, b) => {
    const orden = String(a.ordenId).localeCompare(String(b.ordenId));
    if (orden !== 0) return orden;
    const prioridad = (PRIORIDAD[a.tipo] ?? 99) - (PRIORIDAD[b.tipo] ?? 99);
    if (prioridad !== 0) return prioridad;
    return String(a.creadoEn).localeCompare(String(b.creadoEn));
  });
}

export function filtrarPorUsuario(operaciones, usuarioId) {
  if (!usuarioId) return [];
  return operaciones.filter((operacion) => operacion.usuarioId === usuarioId);
}

export function idsReemplazados(existentes, operacion) {
  if (!TIPOS_UNICOS.includes(operacion.tipo)) return [];
  return existentes
    .filter((item) => item.id !== operacion.id
      && item.ordenId === operacion.ordenId
      && item.tipo === operacion.tipo
      && item.usuarioId === operacion.usuarioId)
    .map((item) => item.id);
}

export function clasificarFallo({ codigo, status } = {}) {
  if (codigo === 'DEPENDENCIA' || codigo === 'CIERRE_INCOMPLETO') return 'dependencia';
  if (CONFLICTOS.has(codigo) || status === 409) return 'conflicto';
  if (status === 422 || status === 400 || status === 403 || status === 404) return 'validacion';
  if (!status || status >= 500 || status === 429 || status === 408 || REINTENTOS.has(codigo)) return 'reintento';
  if (codigo) return 'validacion';
  return 'reintento';
}

export function esperaReintento(operacion, ahora) {
  if (!operacion?.proximoIntento) return false;
  return new Date(operacion.proximoIntento).getTime() > ahora;
}

export function programarReintento(operacion, mensaje, codigo, ahora = Date.now()) {
  const intentos = (operacion.intentos || 0) + 1;
  const espera = Math.min(2000 * (2 ** (intentos - 1)), 5 * 60 * 1000);
  return {
    ...operacion,
    intentos,
    error: mensaje,
    codigo: codigo || 'RED',
    estado: intentos >= MAX_INTENTOS ? 'agotado' : 'reintento',
    proximoIntento: new Date(ahora + espera).toISOString(),
  };
}

export function marcarRetenida(operacion, mensaje, codigo) {
  return {
    ...operacion,
    error: mensaje,
    codigo,
    estado: codigo === 'DEPENDENCIA' ? 'bloqueada' : operacion.estado || 'pendiente',
    proximoIntento: null,
  };
}

export function puedeEnviar(operacion, { ahora, forzar }) {
  if (forzar) return true;
  if (operacion.estado === 'agotado' || operacion.estado === 'validacion') return false;
  if (operacion.estado === 'conflicto' && operacion.codigo !== 'CONCURRENCIA') return false;
  if (esperaReintento(operacion, ahora)) return false;
  return true;
}

export function planificarSincronizacion(operaciones, { ahora = Date.now(), forzar = false } = {}) {
  const { conservar, descartar } = compactar(operaciones);
  const grupos = new Map();
  for (const operacion of ordenarOperaciones(conservar)) {
    if (!grupos.has(operacion.ordenId)) {
      grupos.set(operacion.ordenId, { ordenId: operacion.ordenId, previas: [], evidencias: [], cierres: [], retenidas: [] });
    }
    const grupo = grupos.get(operacion.ordenId);
    const destino = operacion.tipo === 'EVIDENCIA'
      ? 'evidencias'
      : operacion.tipo === 'SOLICITAR_CIERRE'
        ? 'cierres'
        : 'previas';
    if (puedeEnviar(operacion, { ahora, forzar })) grupo[destino].push(operacion);
    else grupo.retenidas.push(operacion);
  }
  return { grupos: [...grupos.values()], descartar };
}

export function resumenCola(operaciones) {
  return {
    pendientes: operaciones.filter((operacion) => !operacion.error && operacion.estado !== 'bloqueada').length,
    errores: operaciones.filter((operacion) => operacion.error || operacion.estado === 'bloqueada').length,
    total: operaciones.length,
  };
}

export function mensajeResultado(resultados) {
  const confirmadas = resultados.filter((resultado) => resultado.ok).length;
  const bloqueadas = resultados.filter((resultado) => resultado.codigo === 'DEPENDENCIA').length;
  const fallidas = resultados.filter((resultado) => !resultado.ok && resultado.codigo !== 'DEPENDENCIA' && resultado.codigo !== 'ESPERA').length;
  if (!confirmadas && !bloqueadas && !fallidas) return null;
  if (fallidas) return { tipo: 'error', texto: `${confirmadas} sincronizadas y ${fallidas} con error. Las pendientes se conservan.` };
  if (bloqueadas) return { tipo: 'warning', texto: `${confirmadas} sincronizadas. El cierre espera la confirmación del diagnóstico, checklist, solución y evidencias.` };
  return { tipo: 'success', texto: `${confirmadas} operaciones sincronizadas.` };
}

export function publicarOperacion(operacion) {
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    ordenId: operacion.ordenId,
    cuerpo: operacion.cuerpo && typeof operacion.cuerpo === 'object' ? operacion.cuerpo : {},
  };
}
