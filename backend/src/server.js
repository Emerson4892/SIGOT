import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { crearApp } from './app.js';

const app = crearApp();
const servidor = app.listen(env.port, () => {
  logger.info({ puerto: env.port }, 'SIGOT API en ejecución');
});

async function cerrar() {
  servidor.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
