import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { puedeTransicionar } from '../src/utils/estadosOrden.js';
import { parsearQr, qrCoincide } from '../src/utils/qr.js';

test('la máquina de estados impide cerrar una orden pendiente', () => {
  assert.equal(puedeTransicionar('PENDIENTE', 'FINALIZADA'), false);
  assert.equal(puedeTransicionar('PENDIENTE', 'ASIGNADA'), true);
  assert.equal(puedeTransicionar('EN_PROCESO', 'PENDIENTE_APROBACION'), true);
  assert.equal(puedeTransicionar('PENDIENTE_APROBACION', 'FINALIZADA'), true);
  assert.equal(puedeTransicionar('FINALIZADA', 'EN_PROCESO'), false);
});

test('el QR solo coincide con el activo exacto', () => {
  const activo = { id: '11111111-1111-1111-1111-111111111111', codigo: 'ACT-1', qrSecreto: 'secreto' };
  const contenido = `SIGOT1|${activo.id}|${activo.codigo}|${activo.qrSecreto}`;
  assert.equal(qrCoincide(activo, contenido), true);
  assert.equal(qrCoincide(activo, contenido.replace('ACT-1', 'ACT-2')), false);
  assert.equal(parsearQr('basura'), null);
});

test('el seed no lee database/restricciones.sql; las restricciones viven en migraciones', () => {
  const seed = readFileSync(new URL('../prisma/seed.js', import.meta.url), 'utf8');
  const migracion = readFileSync(new URL('../prisma/migrations/20261101063000_restricciones/migration.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(seed, /restricciones\.sql/);
  assert.doesNotMatch(seed, /aplicarRestricciones/);
  assert.match(migracion, /repuestos_stock_no_negativo/);
  assert.match(migracion, /movimientos_cantidad_positiva/);
  assert.match(migracion, /auditoria_inmutable/);
});
