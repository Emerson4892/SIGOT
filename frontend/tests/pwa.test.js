import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { manifest } from '../src/pwa/manifest.js';
import { cacheRuntime, rutaApiAutenticada } from '../src/pwa/cachePolicy.js';
import { BASE_LEGADA, decisionAislamiento, decisionCierreSesion, nombreBase } from '../src/pwa/db.js';
import { ejecutarSincronizacion } from '../src/pwa/syncEngine.js';
import {
  MAX_INTENTOS,
  TIPOS_OFFLINE,
  clasificarFallo,
  compactar,
  crearOperacion,
  deduplicar,
  filtrarPorUsuario,
  ordenarOperaciones,
  planificarSincronizacion,
  programarReintento,
  resumenCola,
} from '../src/pwa/syncQueue.js';

const USUARIO = '11111111-1111-4111-8111-111111111111';
const OTRO = '99999999-9999-4999-8999-999999999999';
const ORDEN = '22222222-2222-4222-8222-222222222222';

function operacion(parcial) {
  return {
    id: parcial.id,
    tipo: parcial.tipo,
    ordenId: parcial.ordenId || ORDEN,
    usuarioId: parcial.usuarioId || USUARIO,
    cuerpo: parcial.cuerpo || {},
    creadoEn: parcial.creadoEn || '2026-11-01T00:00:00.000Z',
    intentos: parcial.intentos || 0,
    error: parcial.error || null,
    codigo: parcial.codigo || null,
    estado: parcial.estado || 'pendiente',
    proximoIntento: parcial.proximoIntento || null,
  };
}

test('el manifest de la PWA es instalable', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/tecnico');
  assert.equal(manifest.orientation, 'portrait');
  assert.ok(manifest.icons.some((icono) => icono.sizes === '192x192'));
  assert.ok(manifest.icons.some((icono) => icono.sizes === '512x512'));
});

test('el service worker no cachea respuestas autenticadas', () => {
  assert.deepEqual(cacheRuntime, []);
  assert.equal(rutaApiAutenticada('/api/ordenes'), true);
  assert.equal(rutaApiAutenticada('/api/tecnico/ordenes'), true);
  assert.equal(rutaApiAutenticada('/tecnico'), false);
  const indice = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const generado = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
  const worker = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8');
  assert.match(indice, /rel="manifest"/);
  assert.equal(generado.display, 'standalone');
  assert.match(worker, /denylist/);
  assert.match(worker, /api/);
  assert.doesNotMatch(worker, /sigot-ordenes|NetworkFirst/);
});

test('cada técnico usa una base local distinta y la base compartida queda descartada', () => {
  assert.equal(nombreBase(USUARIO), `sigot-u-${USUARIO}`);
  assert.notEqual(nombreBase(USUARIO), nombreBase(OTRO));
  assert.notEqual(nombreBase(USUARIO), BASE_LEGADA);
  assert.equal(decisionAislamiento(USUARIO, OTRO).eliminarPrevio, true);
  assert.equal(decisionAislamiento(USUARIO, USUARIO).conservarActual, true);
  assert.equal(decisionAislamiento(null, USUARIO).eliminarPrevio, false);
  assert.throws(() => nombreBase(''), /identidad/);
});

test('cerrar sesión conserva pendientes y el cambio de usuario no abre la cola ajena', () => {
  assert.deepEqual(decisionCierreSesion(2), { conservar: true, eliminar: false });
  assert.deepEqual(decisionCierreSesion(0), { conservar: false, eliminar: true });
  const cambioConPendientes = decisionAislamiento(USUARIO, OTRO, 3);
  assert.equal(cambioConPendientes.eliminarPrevio, false);
  assert.equal(cambioConPendientes.conservarPrevio, true);
  assert.equal(cambioConPendientes.conservarActual, false);
  const cambioSinPendientes = decisionAislamiento(USUARIO, OTRO, 0);
  assert.equal(cambioSinPendientes.eliminarPrevio, true);
  assert.equal(cambioSinPendientes.conservarPrevio, false);
  const mismoUsuario = decisionAislamiento(USUARIO, USUARIO, 4);
  assert.equal(mismoUsuario.conservarActual, true);
  assert.equal(mismoUsuario.eliminarPrevio, false);
});

test('la cola offline deduplica, resume y exige identidad', () => {
  const propia = operacion({
    id: '11111111-1111-4111-8111-111111111111',
    tipo: 'DIAGNOSTICO',
    cuerpo: { diagnostico: 'Fuga en el sello' },
  });
  const resumen = resumenCola(deduplicar([propia, { ...propia }, { ...propia, id: 'otra', error: 'fallo' }]));
  assert.equal(resumen.total, 2);
  assert.equal(resumen.pendientes, 1);
  assert.equal(resumen.errores, 1);
  assert.ok(TIPOS_OFFLINE.includes('SOLICITAR_CIERRE'));
  assert.throws(() => crearOperacion({ tipo: 'APROBAR', ordenId: ORDEN, usuarioId: USUARIO }), /servidor/);
  assert.throws(() => crearOperacion({ tipo: 'DIAGNOSTICO', ordenId: ORDEN }), /técnico/);
  assert.equal(filtrarPorUsuario([propia, { ...propia, id: 'ajena', usuarioId: OTRO }], USUARIO).length, 1);
});

test('el cierre queda después del diagnóstico, checklist, solución y evidencias', () => {
  const operaciones = [
    operacion({ id: 'cierre', tipo: 'SOLICITAR_CIERRE', creadoEn: '2026-11-01T00:00:01.000Z' }),
    operacion({ id: 'foto', tipo: 'EVIDENCIA', creadoEn: '2026-11-01T00:00:04.000Z' }),
    operacion({ id: 'solucion', tipo: 'SOLUCION', creadoEn: '2026-11-01T00:00:03.000Z' }),
    operacion({ id: 'diag', tipo: 'DIAGNOSTICO', creadoEn: '2026-11-01T00:00:02.000Z' }),
    operacion({ id: 'check', tipo: 'CHECKLIST', creadoEn: '2026-11-01T00:00:05.000Z' }),
  ];
  assert.deepEqual(ordenarOperaciones(operaciones).map((item) => item.tipo), [
    'CHECKLIST', 'DIAGNOSTICO', 'SOLUCION', 'EVIDENCIA', 'SOLICITAR_CIERRE',
  ]);
  const plan = planificarSincronizacion(operaciones);
  assert.deepEqual(plan.grupos[0].previas.map((item) => item.tipo), ['CHECKLIST', 'DIAGNOSTICO', 'SOLUCION']);
  assert.deepEqual(plan.grupos[0].evidencias.map((item) => item.id), ['foto']);
  assert.deepEqual(plan.grupos[0].cierres.map((item) => item.id), ['cierre']);
});

test('una operación repetida conserva solo la versión más reciente', () => {
  const vieja = operacion({ id: 'vieja', tipo: 'DIAGNOSTICO', creadoEn: '2026-11-01T00:00:01.000Z' });
  const nueva = operacion({ id: 'nueva', tipo: 'DIAGNOSTICO', creadoEn: '2026-11-01T00:00:02.000Z' });
  const foto = operacion({ id: 'foto', tipo: 'EVIDENCIA', creadoEn: '2026-11-01T00:00:03.000Z' });
  const { conservar, descartar } = compactar([vieja, nueva, foto, { ...nueva }]);
  assert.deepEqual(conservar.map((item) => item.id).sort(), ['foto', 'nueva']);
  assert.deepEqual(descartar.map((item) => item.id), ['vieja']);
});

test('los fallos transitorios se reintentan y los conflictos se identifican', () => {
  const base = operacion({ id: 'op', tipo: 'SOLUCION' });
  const reintento = programarReintento(base, 'sin red', 'RED', Date.parse('2026-11-01T00:00:00.000Z'));
  assert.equal(reintento.estado, 'reintento');
  assert.equal(reintento.intentos, 1);
  assert.ok(new Date(reintento.proximoIntento).getTime() > Date.parse('2026-11-01T00:00:00.000Z'));
  const agotado = programarReintento({ ...base, intentos: MAX_INTENTOS - 1 }, 'sin red', 'RED');
  assert.equal(agotado.estado, 'agotado');
  assert.equal(clasificarFallo({ codigo: 'STOCK', status: 409 }), 'conflicto');
  assert.equal(clasificarFallo({ codigo: 'CONCURRENCIA' }), 'conflicto');
  assert.equal(clasificarFallo({ status: 503 }), 'reintento');
  assert.equal(clasificarFallo({ codigo: 'CIERRE_INCOMPLETO' }), 'dependencia');
  assert.equal(clasificarFallo({ codigo: 'DEPENDENCIA' }), 'dependencia');
});

test('la sincronización confirma evidencias antes del cierre y conserva lo pendiente', async () => {
  const cola = [
    operacion({ id: 'cierre', tipo: 'SOLICITAR_CIERRE', creadoEn: '2026-11-01T00:00:01.000Z' }),
    operacion({ id: 'foto', tipo: 'EVIDENCIA', creadoEn: '2026-11-01T00:00:02.000Z' }),
    operacion({ id: 'diag-viejo', tipo: 'DIAGNOSTICO', creadoEn: '2026-11-01T00:00:01.000Z', cuerpo: { diagnostico: 'viejo' } }),
    operacion({ id: 'diag', tipo: 'DIAGNOSTICO', creadoEn: '2026-11-01T00:00:03.000Z', cuerpo: { diagnostico: 'Sello mecánico desgastado.' } }),
    operacion({ id: 'ajena', tipo: 'SOLUCION', usuarioId: OTRO, creadoEn: '2026-11-01T00:00:04.000Z' }),
  ];
  const restantes = new Map(cola.map((item) => [item.id, item]));
  const enviados = [];
  const primerIntento = await ejecutarSincronizacion({
    usuarioId: USUARIO,
    deps: {
      leerCola: async () => [...restantes.values()],
      actualizarCola: async (operacion) => restantes.set(operacion.id, operacion),
      quitarDeCola: async (id) => restantes.delete(id),
      postSync: async (operaciones) => {
        enviados.push(operaciones.map((item) => item.tipo));
        return operaciones.map((item) => ({ id: item.id, ok: true }));
      },
      enviarEvidencia: async () => {
        throw Object.assign(new Error('fallo de red'), { codigo: 'RED' });
      },
    },
  });

  assert.deepEqual(enviados, [['DIAGNOSTICO']]);
  assert.equal(primerIntento.resultados.find((item) => item.id === 'cierre').codigo, 'DEPENDENCIA');
  assert.equal(restantes.has('diag'), false);
  assert.equal(restantes.has('diag-viejo'), false);
  assert.equal(restantes.has('ajena'), true);
  assert.equal(restantes.get('foto').estado, 'reintento');
  assert.equal(restantes.get('cierre').estado, 'bloqueada');
  assert.equal(restantes.get('cierre').intentos, 0);

  enviados.length = 0;
  restantes.get('foto').proximoIntento = null;
  restantes.get('foto').estado = 'pendiente';
  const segundo = await ejecutarSincronizacion({
    usuarioId: USUARIO,
    forzar: true,
    deps: {
      leerCola: async () => [...restantes.values()],
      actualizarCola: async (operacion) => restantes.set(operacion.id, operacion),
      quitarDeCola: async (id) => restantes.delete(id),
      postSync: async (operaciones) => {
        enviados.push(operaciones.map((item) => ({ tipo: item.tipo, id: item.id })));
        return operaciones.map((item) => ({ id: item.id, ok: true }));
      },
      enviarEvidencia: async (operacion) => {
        enviados.push([{ tipo: 'EVIDENCIA', id: operacion.id }]);
      },
    },
  });

  assert.equal(segundo.resultados.find((item) => item.id === 'foto').ok, true);
  assert.equal(segundo.resultados.find((item) => item.id === 'cierre').ok, true);
  assert.deepEqual(enviados.map((lote) => lote[0].tipo), ['EVIDENCIA', 'SOLICITAR_CIERRE']);
  assert.equal(restantes.has('cierre'), false);
  assert.equal(restantes.has('ajena'), true);
});
