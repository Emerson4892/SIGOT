import { prisma } from '../config/db.js';
import { AppError } from './errors.js';
import { partesLock } from './crypto.js';

export function jsonSeguro(valor) {
  return JSON.parse(JSON.stringify(valor ?? {}));
}

export async function conIdempotencia(usuarioId, clave, ruta, fn) {
  return prisma.$transaction(async (tx) => {
    if (clave) {
      const [a, b] = partesLock(clave);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${a}::int4, ${b}::int4)`;
      const previa = await tx.idempotencia.findUnique({ where: { clave } });
      if (previa) {
        if (previa.usuarioId !== usuarioId) {
          throw new AppError(409, 'La clave de idempotencia ya fue utilizada por otro usuario', 'IDEMPOTENCIA');
        }
        return previa.cuerpo;
      }
    }

    const resultado = await fn(tx);
    const cuerpo = jsonSeguro(resultado);
    if (clave) {
      await tx.idempotencia.create({
        data: { clave, usuarioId, ruta, estado: 200, cuerpo },
      });
    }
    return cuerpo;
  }, { timeout: 20000, maxWait: 5000 });
}
