import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(raizBackend, '.env') });

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),
  APP_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  LOG_RESET_LINKS: z.enum(['true', 'false']).default('false'),
  SEED_DEMO_USERS: z.enum(['true', 'false']).default('false'),
});

const datos = esquema.parse(process.env);

export const env = {
  nodeEnv: datos.NODE_ENV,
  isTest: datos.NODE_ENV === 'test',
  isProduction: datos.NODE_ENV === 'production',
  port: datos.PORT,
  databaseUrl: datos.DATABASE_URL,
  jwtSecret: datos.JWT_ACCESS_SECRET,
  jwtTtl: datos.JWT_ACCESS_TTL,
  refreshTtlDays: datos.REFRESH_TTL_DAYS,
  corsOrigins: datos.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean),
  cookieSecure: datos.COOKIE_SECURE === 'true',
  uploadDir: path.resolve(raizBackend, datos.UPLOAD_DIR),
  maxUploadBytes: datos.MAX_UPLOAD_MB * 1024 * 1024,
  appUrl: datos.APP_URL,
  logLevel: datos.LOG_LEVEL,
  trustProxy: datos.TRUST_PROXY === 'true',
  logResetLinks: datos.LOG_RESET_LINKS === 'true',
  seedDemoUsers: datos.SEED_DEMO_USERS === 'true',
};
