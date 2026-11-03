import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function crearLimite(max, windowMs) {
  return rateLimit({
    windowMs,
    max,
    skip: () => env.isTest,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { codigo: 'LIMITE', mensaje: 'Demasiados intentos. Intente más tarde.' } },
  });
}

export const limiteLogin = crearLimite(10, 15 * 60 * 1000);
export const limiteRecuperacion = crearLimite(5, 60 * 60 * 1000);
