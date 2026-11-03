import multer from 'multer';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

export function notFound(_req, _res, next) {
  next(new AppError(404, 'Recurso no encontrado', 'NO_ENCONTRADO'));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles },
    });
  }

  if (err instanceof multer.MulterError) {
    const mensaje = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño permitido'
      : 'No se pudo recibir el archivo';
    return res.status(422).json({ error: { codigo: 'ARCHIVO', mensaje } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'El registro entra en conflicto con uno existente' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Registro no encontrado' } });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: { codigo: 'REFERENCIA', mensaje: 'La operación viola una relación existente' } });
    }
  }

  logger.error({ err }, 'Error no controlado');
  return res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: env.isProduction ? 'Error interno del servidor' : err.message,
    },
  });
}
