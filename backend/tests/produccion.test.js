import assert from 'node:assert/strict';
import test from 'node:test';
import { administradorInicial } from '../src/config/adminInicial.js';
import { construirUrlBase } from '../scripts/database-url.mjs';

test('la URL de PostgreSQL codifica usuario y contraseña', () => {
  const url = construirUrlBase({
    POSTGRES_USER: 'sigot',
    POSTGRES_PASSWORD: 'a/b@c',
    POSTGRES_DB: 'sigot',
    DATABASE_HOST: 'db',
    DATABASE_PORT: '5432',
  });
  assert.equal(url, 'postgresql://sigot:a%2Fb%40c@db:5432/sigot');
});

test('rechaza un nombre de base que rompería la URL', () => {
  assert.throws(() => construirUrlBase({
    POSTGRES_USER: 'sigot',
    POSTGRES_PASSWORD: 'clave',
    POSTGRES_DB: 'sigot-test',
  }), /POSTGRES_DB/);
});

test('los usuarios demo no crean el administrador inicial', () => {
  const admin = administradorInicial({
    SEED_DEMO_USERS: 'true',
    ADMIN_INICIAL_CORREO: 'ops@empresa.com',
    ADMIN_INICIAL_PASSWORD: 'Clave-Segura1',
  });
  assert.equal(admin, null);
});

test('rechaza el administrador de la plantilla de ejemplo', () => {
  assert.throws(() => administradorInicial({
    SEED_DEMO_USERS: 'false',
    ADMIN_INICIAL_CORREO: 'admin@ejemplo.com',
    ADMIN_INICIAL_PASSWORD: 'Cambie-Esta-Clave1',
  }), /ejemplo/);
});

test('acepta un administrador inicial y normaliza el correo', () => {
  const admin = administradorInicial({
    SEED_DEMO_USERS: 'false',
    ADMIN_INICIAL_CORREO: 'Admin@Empresa.com',
    ADMIN_INICIAL_PASSWORD: 'Clave-Segura1',
  });
  assert.equal(admin.correo, 'admin@empresa.com');
  assert.equal(admin.nombre, 'Administrador');
  assert.equal(admin.apellido, 'Inicial');
});
