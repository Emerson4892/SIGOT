import { AppError } from '../utils/errors.js';

export function requirePermission(...codigos) {
  return (req, _res, next) => {
    const permisos = req.user?.permisos || [];
    if (!codigos.every((codigo) => permisos.includes(codigo))) {
      return next(new AppError(403, 'No tiene permiso para esta operación', 'PROHIBIDO'));
    }
    next();
  };
}

export function requireAnyPermission(...codigos) {
  return (req, _res, next) => {
    const permisos = req.user?.permisos || [];
    if (!codigos.some((codigo) => permisos.includes(codigo))) {
      return next(new AppError(403, 'No tiene permiso para esta operación', 'PROHIBIDO'));
    }
    next();
  };
}

const RUTAS_CON_CLAVE_PENDIENTE = new Set([
  'GET /api/auth/perfil',
  'POST /api/auth/cambiar-clave',
  'POST /api/auth/logout',
]);

export function exigirClaveActualizada(req, _res, next) {
  if (!req.user?.debeCambiarClave) return next();
  const ruta = `${req.method} ${req.originalUrl.split('?')[0]}`;
  if (RUTAS_CON_CLAVE_PENDIENTE.has(ruta)) return next();
  return next(new AppError(403, 'Debe cambiar su contraseña antes de continuar', 'CLAVE_PENDIENTE'));
}
