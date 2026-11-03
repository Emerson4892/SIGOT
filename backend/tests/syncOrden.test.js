import assert from 'node:assert/strict';
import test from 'node:test';
import { PREVIAS_CIERRE, cuerpoInvalido, ordenarOperaciones } from '../src/services/syncOrden.js';

test('el servidor ordena el lote y no adelanta el cierre a un paso previo inválido', () => {
  const operaciones = [
    { id: 'c', tipo: 'SOLICITAR_CIERRE', ordenId: 'b' },
    { id: 'd', tipo: 'DIAGNOSTICO', ordenId: 'b' },
    { id: 's', tipo: 'SOLUCION', ordenId: 'a' },
    { id: 'k', tipo: 'CHECKLIST', ordenId: 'b' },
  ];
  assert.deepEqual(ordenarOperaciones(operaciones).map((item) => item.id), ['s', 'k', 'd', 'c']);
  assert.deepEqual(PREVIAS_CIERRE, ['CHECKLIST', 'DIAGNOSTICO', 'SOLUCION']);
  assert.equal(cuerpoInvalido({ tipo: 'DIAGNOSTICO', cuerpo: {} }), 'Falta el diagnóstico');
  assert.equal(cuerpoInvalido({ tipo: 'SOLICITAR_CIERRE', cuerpo: {} }), null);
});
