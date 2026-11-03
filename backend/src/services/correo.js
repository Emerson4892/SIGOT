import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const capturas = [];

export const buzonLocal = {
  ultimo() {
    return capturas.at(-1) ?? null;
  },
  limpiar() {
    capturas.length = 0;
  },
};

export function enviarRecuperacion({ correo, url }) {
  capturas.push({ correo, url, en: new Date().toISOString() });
  if (env.logResetLinks || !env.isProduction) {
    logger.info({ correo, url }, 'Enlace local de recuperación de contraseña');
  } else {
    logger.warn({ correo }, 'No hay SMTP configurado; el enlace de recuperación no se envió');
  }
}
