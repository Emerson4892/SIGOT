import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { prisma } from '../../src/config/db.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function preparar() {
  const destino = new URL(process.env.DATABASE_URL);
  const nombre = destino.pathname.slice(1);
  const admin = new URL(process.env.DATABASE_URL);
  admin.pathname = '/postgres';
  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${nombre}"`);
  await cliente.end();

  execSync('npx prisma migrate deploy', {
    cwd: backend,
    env: process.env,
    stdio: 'pipe',
  });

  const tablas = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tablas.length) {
    const lista = tablas.map((tabla) => `"${tabla.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
  }

  execSync('node prisma/seed.js', {
    cwd: backend,
    env: process.env,
    stdio: 'pipe',
  });
}

export { prisma };
