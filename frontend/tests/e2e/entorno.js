import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../backend/.env');

export function cargarEntorno() {
  const valores = {};
  if (existsSync(backendEnv)) {
    const texto = readFileSync(backendEnv, 'utf8');
    for (const linea of texto.split(/\r?\n/)) {
      const coincidencia = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
      if (!coincidencia) continue;
      valores[coincidencia[1]] = coincidencia[2].replace(/^["']|["']$/g, '');
    }
  }
  for (const [clave, valor] of Object.entries(process.env)) {
    if (valor != null && valor !== '') valores[clave] = valor;
  }
  return valores;
}
