import { claveSchema, correoSchema } from '../validators/comun.js';

const CORREOS_EJEMPLO = new Set(['admin@ejemplo.com']);
const CLAVES_EJEMPLO = new Set(['Cambie-Esta-Clave1', 'cambie-esta-clave']);

function mensaje(resultado) {
  return resultado.error.issues.map((item) => item.message).join(' ');
}

export function administradorInicial(env = process.env) {
  if (env.SEED_DEMO_USERS === 'true') return null;
  const correoPlano = (env.ADMIN_INICIAL_CORREO ?? '').trim();
  const contrasena = env.ADMIN_INICIAL_PASSWORD ?? '';
  const nombre = (env.ADMIN_INICIAL_NOMBRE ?? '').trim() || 'Administrador';
  const apellido = (env.ADMIN_INICIAL_APELLIDO ?? '').trim() || 'Inicial';
  if (!correoPlano && !contrasena) return null;
  if (!correoPlano || !contrasena) {
    throw new Error('Defina ADMIN_INICIAL_CORREO y ADMIN_INICIAL_PASSWORD juntos.');
  }
  if (CORREOS_EJEMPLO.has(correoPlano.toLowerCase()) || CLAVES_EJEMPLO.has(contrasena)) {
    throw new Error('ADMIN_INICIAL_CORREO o ADMIN_INICIAL_PASSWORD siguen siendo el valor de ejemplo.');
  }
  if (contrasena.length > 200) throw new Error('ADMIN_INICIAL_PASSWORD supera 200 caracteres.');
  const correo = correoSchema.safeParse(correoPlano);
  if (!correo.success) throw new Error(`ADMIN_INICIAL_CORREO: ${mensaje(correo)}`);
  const clave = claveSchema.safeParse(contrasena);
  if (!clave.success) throw new Error(`ADMIN_INICIAL_PASSWORD: ${mensaje(clave)}`);
  if (nombre.length < 2 || nombre.length > 80 || apellido.length < 2 || apellido.length > 80) {
    throw new Error('ADMIN_INICIAL_NOMBRE y ADMIN_INICIAL_APELLIDO deben tener entre 2 y 80 caracteres.');
  }
  return { correo: correo.data, contrasena: clave.data, nombre, apellido };
}
