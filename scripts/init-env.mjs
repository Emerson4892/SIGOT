import { randomBytes } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendEnv = path.join(raiz, 'backend', '.env');
const rootEnv = path.join(raiz, '.env');
const credenciales = path.join(raiz, '.seed-credentials');

if (existsSync(backendEnv) || existsSync(rootEnv)) {
  console.log('Los archivos .env ya existen. No se sobrescribieron.');
  process.exit(0);
}

function secreto(bytes) {
  return randomBytes(bytes).toString('hex');
}

function clave() {
  const conjuntos = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '*-_.'];
  const obligatorio = conjuntos.map((grupo) => grupo[randomBytes(1)[0] % grupo.length]);
  const alfabeto = conjuntos.join('');
  const resto = Array.from(randomBytes(16), (byte) => alfabeto[byte % alfabeto.length]);
  return [...obligatorio, ...resto].sort(() => (randomBytes(1)[0] > 127 ? 1 : -1)).join('');
}

const postgresPassword = secreto(24);
const jwt = secreto(48);
const claves = {
  SEED_ADMIN_PASSWORD: clave(),
  SEED_OPERATOR_PASSWORD: clave(),
  SEED_SUPERVISOR_PASSWORD: clave(),
  SEED_TECHNICIAN_PASSWORD: clave(),
  SEED_WAREHOUSE_PASSWORD: clave(),
};

const comun = `POSTGRES_USER=sigot
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=sigot
JWT_ACCESS_SECRET=${jwt}
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=7
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=8
LOG_LEVEL=info
TRUST_PROXY=false
LOG_RESET_LINKS=true
SEED_DEMO_USERS=true
SEED_ADMIN_PASSWORD=${claves.SEED_ADMIN_PASSWORD}
SEED_OPERATOR_PASSWORD=${claves.SEED_OPERATOR_PASSWORD}
SEED_SUPERVISOR_PASSWORD=${claves.SEED_SUPERVISOR_PASSWORD}
SEED_TECHNICIAN_PASSWORD=${claves.SEED_TECHNICIAN_PASSWORD}
SEED_WAREHOUSE_PASSWORD=${claves.SEED_WAREHOUSE_PASSWORD}
`;

writeFileSync(rootEnv, `${comun}`, { encoding: 'utf8' });
writeFileSync(backendEnv, `${comun}
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://sigot:${postgresPassword}@localhost:5432/sigot
TEST_DATABASE_URL=postgresql://sigot:${postgresPassword}@localhost:5432/sigot_test
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
COOKIE_SECURE=false
`, { encoding: 'utf8' });

writeFileSync(credenciales, `Usuarios locales de SIGOT. Este archivo está ignorado por git.

Administrador  admin@sigot.local       ${claves.SEED_ADMIN_PASSWORD}
Operador       operador@sigot.local    ${claves.SEED_OPERATOR_PASSWORD}
Supervisor     supervisor@sigot.local  ${claves.SEED_SUPERVISOR_PASSWORD}
Técnico        tecnico@sigot.local     ${claves.SEED_TECHNICIAN_PASSWORD}
Bodega         bodega@sigot.local      ${claves.SEED_WAREHOUSE_PASSWORD}
`, { encoding: 'utf8' });

console.log('Variables locales creadas en .env, backend/.env y .seed-credentials');
