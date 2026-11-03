import { env } from '../config/env.js';

export const COOKIES = {
  access: 'sigot_access',
  refresh: 'sigot_refresh',
};

function milisegundos(ttl) {
  const coincidencia = /^(\d+)([smhd])$/.exec(ttl);
  if (!coincidencia) return 15 * 60 * 1000;
  const cantidad = Number(coincidencia[1]);
  const unidad = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[coincidencia[2]];
  return cantidad * unidad;
}

const baseAccess = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
});

const baseRefresh = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'strict',
  path: '/api/auth',
});

export function establecerSesion(res, { access, refresh }) {
  res.cookie(COOKIES.access, access, { ...baseAccess(), maxAge: milisegundos(env.jwtTtl) });
  res.cookie(COOKIES.refresh, refresh, { ...baseRefresh(), maxAge: env.refreshTtlDays * 86400000 });
}

export function limpiarSesion(res) {
  res.clearCookie(COOKIES.access, baseAccess());
  res.clearCookie(COOKIES.refresh, baseRefresh());
}
