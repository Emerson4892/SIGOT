import argon2 from 'argon2';

export const OPCIONES_ARGON = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashContrasena(contrasena) {
  return argon2.hash(contrasena, OPCIONES_ARGON);
}

export async function verificarContrasena(hash, contrasena) {
  try {
    return await argon2.verify(hash, contrasena);
  } catch {
    return false;
  }
}
