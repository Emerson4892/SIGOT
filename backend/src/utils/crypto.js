import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function tokenAleatorio(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(valor) {
  return createHash('sha256').update(String(valor)).digest('hex');
}

export function igualSeguro(a, b) {
  const izquierda = Buffer.from(String(a));
  const derecha = Buffer.from(String(b));
  if (izquierda.length === 0 || izquierda.length !== derecha.length) return false;
  return timingSafeEqual(izquierda, derecha);
}

export function partesLock(clave) {
  const buf = createHash('sha256').update(String(clave)).digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}
