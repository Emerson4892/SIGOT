function fallo(mensaje) {
  const error = new Error(mensaje);
  error.sigot = true;
  throw error;
}

export function construirUrlBase(env = process.env) {
  const usuario = env.POSTGRES_USER ?? '';
  const clave = env.POSTGRES_PASSWORD ?? '';
  const base = env.POSTGRES_DB ?? '';
  const host = env.DATABASE_HOST || 'db';
  const port = String(env.DATABASE_PORT || '5432');
  if (!usuario || !clave || !base) fallo('Faltan POSTGRES_USER, POSTGRES_PASSWORD o POSTGRES_DB');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(usuario)) fallo('POSTGRES_USER solo admite letras, números y guion bajo');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) fallo('POSTGRES_DB solo admite letras, números y guion bajo');
  if (!/^[A-Za-z0-9.-]+$/.test(host)) fallo('DATABASE_HOST no es válido');
  if (!/^[0-9]+$/.test(port)) fallo('DATABASE_PORT no es válido');
  return `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${host}:${port}/${base}`;
}

const ejecutado = process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/database-url.mjs');
if (ejecutado) {
  try {
    process.stdout.write(construirUrlBase());
  } catch (error) {
    console.error(`SIGOT: ${error.message}`);
    process.exit(1);
  }
}
