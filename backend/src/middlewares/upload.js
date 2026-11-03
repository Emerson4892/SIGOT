import multer from 'multer';
import { env } from '../config/env.js';

export const subirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
}).single('archivo');
