import { igualSeguro } from './crypto.js';

export function contenidoQr(activo) {
  return `SIGOT1|${activo.id}|${activo.codigo}|${activo.qrSecreto}`;
}

export function parsearQr(texto) {
  const partes = String(texto || '').trim().split('|');
  if (partes.length !== 4 || partes[0] !== 'SIGOT1') return null;
  const [, id, codigo, secreto] = partes;
  if (!id || !codigo || !secreto) return null;
  return { id, codigo, secreto };
}

export function qrCoincide(activo, contenido) {
  const parsed = parsearQr(contenido);
  if (!parsed) return false;
  return parsed.id === activo.id
    && parsed.codigo === activo.codigo
    && igualSeguro(parsed.secreto, activo.qrSecreto);
}
