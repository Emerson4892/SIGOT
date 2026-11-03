import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { igualSeguro } from '../utils/crypto.js';

export function verificarOrigen(req, _res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  if (!env.corsOrigins.includes(origin)) {
    return next(new AppError(403, 'Origen no permitido', 'ORIGEN'));
  }
  next();
}

export function csrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const header = req.get('x-csrf-token') || '';
  const esperado = req.user?.csrfToken || '';
  if (!igualSeguro(header, esperado)) {
    return next(new AppError(403, 'La solicitud no incluye un token CSRF válido', 'CSRF'));
  }
  next();
}
