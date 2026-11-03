import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

export function crearApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({
    logger,
    autoLogging: env.isTest ? false : { ignore: (req) => req.url === '/api/salud' },
  }));

  app.get('/api/salud', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ servicio: 'sigot', estado: 'ok', baseDatos: 'ok' });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
