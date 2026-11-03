import { openDB } from 'idb';
import { idsReemplazados } from './syncQueue.js';

export const BASE_LEGADA = 'sigot-campo';
const CLAVE_USUARIO = 'sigot-usuario-activo';

export function nombreBase(usuarioId) {
  if (!usuarioId || typeof usuarioId !== 'string') {
    throw new Error('La base local exige la identidad del técnico');
  }
  return `sigot-u-${usuarioId}`;
}

export function decisionAislamiento(previo, siguiente, pendientesPrevio = 0) {
  const distinto = Boolean(previo && previo !== siguiente);
  return {
    eliminarPrevio: distinto && pendientesPrevio === 0,
    conservarPrevio: distinto && pendientesPrevio > 0,
    conservarActual: previo === siguiente,
  };
}

export function decisionCierreSesion(pendientes) {
  const cantidad = Number(pendientes) || 0;
  return {
    conservar: cantidad > 0,
    eliminar: cantidad <= 0,
  };
}

let usuarioActivo = null;

export function usuarioLocal() {
  return usuarioActivo;
}

function exigirUsuario() {
  if (!usuarioActivo) throw new Error('No hay una sesión local activa');
  return usuarioActivo;
}

function recordarUsuario(usuarioId) {
  usuarioActivo = usuarioId;
  if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE_USUARIO, usuarioId);
}

function usuarioRecordado() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CLAVE_USUARIO);
}

function olvidarUsuario() {
  usuarioActivo = null;
  if (typeof localStorage !== 'undefined') localStorage.removeItem(CLAVE_USUARIO);
}

function eliminarBase(nombre) {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    const solicitud = indexedDB.deleteDatabase(nombre);
    solicitud.onsuccess = () => resolve();
    solicitud.onerror = () => resolve();
    solicitud.onblocked = () => resolve();
  });
}

async function baseExiste(nombre) {
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases === 'function') {
    try {
      const lista = await indexedDB.databases();
      return lista.some((item) => item.name === nombre);
    } catch {
      return true;
    }
  }
  return true;
}

function prepararAlmacenes(base) {
  if (!base.objectStoreNames.contains('ordenes')) base.createObjectStore('ordenes', { keyPath: 'id' });
  if (!base.objectStoreNames.contains('outbox')) base.createObjectStore('outbox', { keyPath: 'id' });
  if (!base.objectStoreNames.contains('archivos')) base.createObjectStore('archivos', { keyPath: 'id' });
}

// Limpia únicamente cachés privadas de SIGOT.
// Conserva los archivos públicos almacenados por Workbox.

export async function limpiarCachesAutenticadas() {
  if (typeof caches === 'undefined') return;

  const claves = await caches.keys();

  const cachesPrivadas = claves.filter((clave) =>
    clave.startsWith('sigot-auth-')
  );

  await Promise.all(
    cachesPrivadas.map((clave) => caches.delete(clave))
  );
}

async function conBase(fn) {
  const db = await openDB(nombreBase(exigirUsuario()), 1, { upgrade: prepararAlmacenes });
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function contarPendientes(usuarioId = usuarioActivo || usuarioRecordado()) {
  if (!usuarioId) return 0;
  const nombre = nombreBase(usuarioId);
  if (!(await baseExiste(nombre))) return 0;
  const db = await openDB(nombre, 1, { upgrade: prepararAlmacenes });
  try {
    if (!db.objectStoreNames.contains('outbox')) return 0;
    const cola = await db.getAll('outbox');
    return cola.filter((operacion) => !operacion.usuarioId || operacion.usuarioId === usuarioId).length;
  } finally {
    db.close();
  }
}

export async function activarUsuario(usuarioId) {
  if (!usuarioId) throw new Error('La base local exige la identidad del técnico');
  const previo = usuarioActivo || usuarioRecordado();
  const pendientesPrevio = previo && previo !== usuarioId ? await contarPendientes(previo) : 0;
  const decision = decisionAislamiento(previo, usuarioId, pendientesPrevio);
  if (decision.eliminarPrevio) {
    await eliminarBase(nombreBase(previo));
  }
  if (previo && previo !== usuarioId) {
    await limpiarCachesAutenticadas();
  }
  recordarUsuario(usuarioId);
  await eliminarBase(BASE_LEGADA);
}

export async function limpiarSesionLocal() {
  const previo = usuarioActivo || usuarioRecordado();
  const pendientes = previo ? await contarPendientes(previo) : 0;
  const decision = decisionCierreSesion(pendientes);
  olvidarUsuario();
  if (previo && decision.eliminar) await eliminarBase(nombreBase(previo));
  await eliminarBase(BASE_LEGADA);
  await limpiarCachesAutenticadas();
  return { pendientes, conservada: Boolean(previo && decision.conservar) };
}

export async function guardarOrdenes(ordenes) {
  const usuarioId = exigirUsuario();
  await conBase(async (db) => {
    const tx = db.transaction('ordenes', 'readwrite');
    await tx.store.clear();
    for (const orden of ordenes) tx.store.put({ ...orden, usuarioId });
    await tx.done;
  });
}

export async function leerOrdenes() {
  const usuarioId = exigirUsuario();
  return conBase(async (db) => {
    const ordenes = await db.getAll('ordenes');
    return ordenes.filter((orden) => orden.usuarioId === usuarioId);
  });
}

export async function encolar(operacion, archivo = null) {
  const usuarioId = operacion.usuarioId || exigirUsuario();
  if (usuarioActivo && usuarioId !== usuarioActivo) {
    throw new Error('La operación no corresponde al técnico autenticado');
  }
  const completa = { ...operacion, usuarioId, cuerpo: operacion.cuerpo ?? {}, estado: operacion.estado || 'pendiente' };
  await conBase(async (db) => {
    const existentes = await db.getAll('outbox');
    for (const id of idsReemplazados(existentes, completa)) {
      await db.delete('outbox', id);
      await db.delete('archivos', id);
    }
    await db.put('outbox', completa);
    if (archivo) {
      await db.put('archivos', { id: completa.id, blob: archivo.blob, nombre: archivo.nombre, usuarioId });
    }
  });
}

export async function leerCola() {
  const usuarioId = exigirUsuario();
  return conBase(async (db) => {
    const cola = await db.getAll('outbox');
    return cola.filter((operacion) => operacion.usuarioId === usuarioId);
  });
}

export async function actualizarCola(operacion) {
  const usuarioId = exigirUsuario();
  if (operacion.usuarioId !== usuarioId) {
    throw new Error('La operación no corresponde al técnico autenticado');
  }
  await conBase((db) => db.put('outbox', operacion));
}

export async function quitarDeCola(id) {
  await conBase(async (db) => {
    await db.delete('outbox', id);
    await db.delete('archivos', id);
  });
}

export async function leerArchivo(id) {
  const usuarioId = exigirUsuario();
  return conBase(async (db) => {
    const archivo = await db.get('archivos', id);
    if (archivo && archivo.usuarioId && archivo.usuarioId !== usuarioId) return null;
    return archivo;
  });
}
