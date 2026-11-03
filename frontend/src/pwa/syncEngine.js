import {
  PREVIAS_CIERRE,
  clasificarFallo,
  filtrarPorUsuario,
  marcarRetenida,
  mensajeResultado,
  planificarSincronizacion,
  programarReintento,
  publicarOperacion,
} from './syncQueue.js';

const MENSAJE_CIERRE = 'El cierre espera la confirmación del diagnóstico, checklist, solución y evidencias.';

function mensajeDe(error) {
  return error?.response?.data?.error?.mensaje || error?.message || 'No se pudo sincronizar la operación';
}

function codigoDe(error) {
  return error?.response?.data?.error?.codigo || error?.codigo || 'RED';
}

async function aplicarFallo(operacion, { codigo, status, mensaje }, deps, ahora) {
  const clase = clasificarFallo({ codigo, status });
  if (clase === 'reintento') {
    await deps.actualizarCola(programarReintento(operacion, mensaje, codigo, ahora));
  } else if (clase === 'dependencia') {
    await deps.actualizarCola(marcarRetenida(operacion, mensaje, 'DEPENDENCIA'));
  } else {
    await deps.actualizarCola({
      ...operacion,
      error: mensaje,
      codigo,
      estado: clase,
      proximoIntento: null,
    });
  }
  return { id: operacion.id, ok: false, codigo: clase === 'dependencia' ? 'DEPENDENCIA' : codigo, mensaje };
}

async function enviarLote(operaciones, deps, resultados, ahora) {
  if (!operaciones.length) return;
  try {
    const respuesta = await deps.postSync(operaciones.map(publicarOperacion));
    const porId = new Map(respuesta.map((resultado) => [resultado.id, resultado]));
    for (const operacion of operaciones) {
      const resultado = porId.get(operacion.id);
      if (!resultado) {
        resultados.push(await aplicarFallo(operacion, { codigo: 'RED', mensaje: 'El servidor no confirmó la operación' }, deps, ahora));
        continue;
      }
      if (resultado.ok) {
        await deps.quitarDeCola(operacion.id);
        resultados.push({ id: operacion.id, ok: true, tipo: operacion.tipo });
      } else {
        resultados.push(await aplicarFallo(operacion, {
          codigo: resultado.codigo,
          mensaje: resultado.mensaje || 'No se pudo sincronizar la operación',
        }, deps, ahora));
      }
    }
  } catch (error) {
    for (const operacion of operaciones) {
      resultados.push(await aplicarFallo(operacion, {
        codigo: codigoDe(error),
        status: error?.response?.status,
        mensaje: mensajeDe(error),
      }, deps, ahora));
    }
  }
}

export async function ejecutarSincronizacion({ usuarioId, ahora = Date.now(), forzar = false, notificar, deps }) {
  if (!usuarioId) return { resultados: [], resumen: mensajeResultado([]) };
  const cola = filtrarPorUsuario(await deps.leerCola(), usuarioId);
  const plan = planificarSincronizacion(cola, { ahora, forzar });
  for (const descartada of plan.descartar) await deps.quitarDeCola(descartada.id);

  const resultados = [];
  for (const grupo of plan.grupos) {
    const marca = resultados.length;
    await enviarLote(grupo.previas, deps, resultados, ahora);
    const previasOk = grupo.previas.every((operacion) => {
      if (!PREVIAS_CIERRE.includes(operacion.tipo)) return true;
      const resultado = resultados.slice(marca).find((item) => item.id === operacion.id);
      return resultado?.ok === true;
    });
    let evidenciasOk = true;
    for (const evidencia of grupo.evidencias) {
      try {
        await deps.enviarEvidencia(evidencia);
        await deps.quitarDeCola(evidencia.id);
        resultados.push({ id: evidencia.id, ok: true, tipo: 'EVIDENCIA' });
      } catch (error) {
        evidenciasOk = false;
        resultados.push(await aplicarFallo(evidencia, {
          codigo: codigoDe(error),
          status: error?.response?.status,
          mensaje: mensajeDe(error),
        }, deps, ahora));
      }
    }
    const retenidaPrevia = grupo.retenidas.some((operacion) => PREVIAS_CIERRE.includes(operacion.tipo));
    const cierreBloqueado = !previasOk || !evidenciasOk || retenidaPrevia;
    if (cierreBloqueado) {
      for (const cierre of grupo.cierres) {
        await deps.actualizarCola(marcarRetenida(cierre, MENSAJE_CIERRE, 'DEPENDENCIA'));
        resultados.push({ id: cierre.id, ok: false, codigo: 'DEPENDENCIA', mensaje: MENSAJE_CIERRE });
      }
      continue;
    }
    await enviarLote(grupo.cierres, deps, resultados, ahora);
  }

  const resumen = mensajeResultado(resultados);
  if (resumen && notificar) notificar(resumen.texto, resumen.tipo);
  return { resultados, resumen };
}
