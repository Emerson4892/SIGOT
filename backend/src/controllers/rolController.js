import * as rolService from '../services/rolService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { contexto } from '../utils/http.js';

export const listar = asyncHandler(async (_req, res) => {
  res.json({ datos: await rolService.listarRoles() });
});

export const permisos = asyncHandler(async (_req, res) => {
  res.json({ datos: await rolService.listarPermisos() });
});

export const actualizarPermisos = asyncHandler(async (req, res) => {
  res.json(await rolService.actualizarPermisos(req.user, req.valid.params.id, req.valid.body.permisos, contexto(req)));
});
