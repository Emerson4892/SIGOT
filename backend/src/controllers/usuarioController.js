import * as usuarioService from '../services/usuarioService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { contexto } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await usuarioService.listar(req.valid.query));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await usuarioService.crear(req.user, req.valid.body, contexto(req)));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await usuarioService.actualizar(req.user, req.valid.params.id, req.valid.body, contexto(req)));
});

export const asignarRoles = asyncHandler(async (req, res) => {
  res.json(await usuarioService.asignarRoles(req.user, req.valid.params.id, req.valid.body.roles, contexto(req)));
});

export const desactivar = asyncHandler(async (req, res) => {
  res.json(await usuarioService.cambiarActivo(req.user, req.valid.params.id, false, contexto(req)));
});

export const activar = asyncHandler(async (req, res) => {
  res.json(await usuarioService.cambiarActivo(req.user, req.valid.params.id, true, contexto(req)));
});
