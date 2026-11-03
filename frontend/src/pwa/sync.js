import { api } from '../services/api.js';
import { leerArchivo, leerCola, quitarDeCola, actualizarCola, usuarioLocal } from './db.js';
import { ejecutarSincronizacion } from './syncEngine.js';

export async function sincronizarCola(opciones = {}) {
  const leer = opciones.leerCola || leerCola;
  const deps = {
    leerCola: leer,
    actualizarCola: opciones.actualizarCola || actualizarCola,
    quitarDeCola: opciones.quitarDeCola || quitarDeCola,
    postSync: opciones.postSync || (async (operaciones) => {
      const respuesta = await api.post('/sync', { operaciones });
      return respuesta.data.resultados;
    }),
    enviarEvidencia: opciones.enviarEvidencia || (async (operacion) => {
      const archivo = await (opciones.leerArchivo || leerArchivo)(operacion.id);
      if (!archivo?.blob) {
        const error = new Error('La evidencia local no está disponible');
        error.codigo = 'ARCHIVO';
        throw error;
      }
      const formulario = new FormData();
      formulario.append('archivo', archivo.blob, archivo.nombre || 'evidencia');
      await api.post(`/ordenes/${operacion.ordenId}/evidencias`, formulario, {
        headers: { 'X-Idempotency-Key': operacion.id },
      });
    }),
  };
  return ejecutarSincronizacion({
    usuarioId: opciones.usuarioId || usuarioLocal(),
    ahora: opciones.ahora,
    forzar: opciones.forzar,
    notificar: opciones.notificar,
    deps,
  });
}
