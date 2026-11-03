import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'contrasena',
      'password',
      'token',
      'refresh',
      'csrfToken',
      '*.contrasena',
      '*.password',
      '*.token',
      '*.contrasenaHash',
    ],
    censor: '[redactado]',
  },
  transport: env.nodeEnv === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
});
