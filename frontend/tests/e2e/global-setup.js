import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../backend');

export default function prepararBase() {
  const entorno = cargarEntorno();
  if (!entorno.TEST_DATABASE_URL && !entorno.DATABASE_URL) {
    throw new Error('Falta TEST_DATABASE_URL o DATABASE_URL para la prueba de interfaz');
  }
  const envFile = existsSync(path.join(backend, '.env')) ? '--env-file=.env' : '';
  execSync(`node ${envFile} --import ./tests/helpers/load-env.js --input-type=module -e "import { preparar } from './tests/helpers/db.js'; await preparar();"`, {
    cwd: backend,
    stdio: 'inherit',
    env: { ...process.env, ...entorno, NODE_ENV: 'test' },
  });
}
