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

export async function enviarRecuperacion({ correo, url }) {
  // En desarrollo y pruebas conservamos el buzón local.
  if (!env.isProduction) {
    capturas.push({
      correo,
      url,
      en: new Date().toISOString(),
    });

    if (env.logResetLinks) {
      logger.info({ correo, url }, 'Enlace local de recuperación');
    }

    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.error('RESEND_API_KEY no está configurada');
    return false;
  }

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SIGOT <noreply@mail.emersontzib.site>',
        to: [correo],
        subject: 'SIGOT - Recuperación de contraseña',
        text: [
          'Has solicitado recuperar tu contraseña de SIGOT.',
          '',
          'Utiliza el siguiente enlace:',
          url,
          '',
          'Este enlace vence en 30 minutos.',
          '',
          'Si no solicitaste el cambio, ignora este mensaje.',
        ].join('\n'),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!respuesta.ok) {
      logger.error(
        { status: respuesta.status },
        'Resend rechazó el envío del correo'
      );
      return false;
    }

    logger.info('Correo de recuperación aceptado por Resend');
    return true;
  } catch (error) {
    logger.error(
      { mensaje: error.message },
      'Error al conectar con Resend'
    );
    return false;
  }
}