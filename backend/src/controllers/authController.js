import * as authService from '../services/authService.js';
import { COOKIES, establecerSesion, limpiarSesion } from '../utils/cookies.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { contexto } from '../utils/http.js';

function responderSesion(res, resultado, status = 200) {
  establecerSesion(res, resultado);
  res.status(status).json({ usuario: resultado.usuario, csrfToken: resultado.csrfToken });
}

export const login = asyncHandler(async (req, res) => {
  const resultado = await authService.login({ ...req.valid.body, ...contexto(req) });
  responderSesion(res, resultado);
});

export const refrescar = asyncHandler(async (req, res) => {
  const resultado = await authService.refrescar(req.cookies?.[COOKIES.refresh]);
  responderSesion(res, resultado);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.revocarPorRefresh(req.cookies?.[COOKIES.refresh]);
  limpiarSesion(res);
  res.json({ mensaje: 'Sesión cerrada' });
});

export const perfil = asyncHandler(async (req, res) => {
  const usuario = await authService.perfil(req.user.id);
  res.json({ usuario, csrfToken: req.user.csrfToken });
});

export const cambiarClave = asyncHandler(async (req, res) => {
  const resultado = await authService.cambiarClave(req.user, req.valid.body, contexto(req));
  responderSesion(res, resultado);
});

export const recuperar = asyncHandler(async (req, res) => {
  const resultado = await authService.recuperar({ ...req.valid.body, ...contexto(req) });
  res.json(resultado);
});

export const restablecer = asyncHandler(async (req, res) => {
  const resultado = await authService.restablecer({ ...req.valid.body, ...contexto(req) });
  res.json(resultado);
});

export const sesiones = asyncHandler(async (req, res) => {
  res.json({ datos: await authService.sesiones(req.user) });
});

export const revocarSesion = asyncHandler(async (req, res) => {
  const resultado = await authService.revocarSesion(req.user, req.valid.params.id, contexto(req));
  if (resultado.actual) limpiarSesion(res);
  res.json({ mensaje: 'Sesión revocada' });
});
