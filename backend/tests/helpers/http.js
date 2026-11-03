import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';

export const app = crearApp();

export function agente() {
  return request.agent(app);
}

export async function entrar(agent, correo, variable) {
  const contrasena = process.env[variable];
  assert.ok(contrasena, `Falta ${variable} en el entorno de prueba`);
  const respuesta = await agent.post('/api/auth/login').send({ correo, contrasena });
  assert.equal(respuesta.status, 200, JSON.stringify(respuesta.body));
  agent.set('X-CSRF-Token', respuesta.body.csrfToken);
  return respuesta.body;
}

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
