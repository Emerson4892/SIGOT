import { AppError } from '../utils/errors.js';
import * as checklistService from './checklistService.js';
import * as ordenService from './ordenService.js';
import { PREVIAS_CIERRE, cuerpoInvalido, ordenarOperaciones } from './syncOrden.js';

const DESPACHADORES = {
  DIAGNOSTICO: (usuario, item, ctx) => ordenService.diagnostico(usuario, item.ordenId, item.cuerpo.diagnostico, ctx, item.id),
  SOLUCION: (usuario, item, ctx) => ordenService.solucion(usuario, item.ordenId, item.cuerpo.solucion, ctx, item.id),
  CHECKLIST: (usuario, item, ctx) => checklistService.completar(usuario, item.ordenId, item.cuerpo, ctx, item.id),
  REPUESTOS: (usuario, item, ctx) => ordenService.registrarRepuestos(usuario, item.ordenId, item.cuerpo.items, ctx, item.id),
  SOLICITAR_CIERRE: (usuario, item, ctx) => ordenService.solicitarCierre(usuario, item.ordenId, ctx, item.id),
};

const MENSAJE_DEPENDENCIA = 'El cierre espera la confirmación del diagnóstico, checklist y solución.';

export async function sincronizar(usuario, operaciones, ctx) {
  const resultados = [];
  const vistos = new Set();
  const fallosPrevios = new Set();
  for (const item of ordenarOperaciones(operaciones)) {
    if (vistos.has(item.id)) {
      resultados.push({ id: item.id, ok: false, codigo: 'DUPLICADO', mensaje: 'La operación está repetida en el lote' });
      continue;
    }
    vistos.add(item.id);
    if (item.tipo === 'SOLICITAR_CIERRE' && fallosPrevios.has(item.ordenId)) {
      resultados.push({ id: item.id, ok: false, codigo: 'DEPENDENCIA', mensaje: MENSAJE_DEPENDENCIA });
      continue;
    }
    const invalido = cuerpoInvalido(item);
    if (invalido) {
      if (PREVIAS_CIERRE.includes(item.tipo)) fallosPrevios.add(item.ordenId);
      resultados.push({ id: item.id, ok: false, codigo: 'VALIDACION', mensaje: invalido });
      continue;
    }
    const despachar = DESPACHADORES[item.tipo];
    if (!despachar) {
      resultados.push({ id: item.id, ok: false, codigo: 'TIPO', mensaje: 'Operación no admitida para sincronización' });
      continue;
    }
    try {
      const cuerpo = await despachar(usuario, item, ctx);
      resultados.push({ id: item.id, ok: true, cuerpo });
    } catch (error) {
      if (PREVIAS_CIERRE.includes(item.tipo)) fallosPrevios.add(item.ordenId);
      if (error instanceof AppError) {
        resultados.push({ id: item.id, ok: false, codigo: error.codigo, mensaje: error.message });
      } else {
        resultados.push({ id: item.id, ok: false, codigo: 'ERROR', mensaje: 'No se pudo sincronizar la operación' });
      }
    }
  }
  return { resultados };
}
