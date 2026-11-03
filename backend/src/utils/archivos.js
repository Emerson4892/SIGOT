import path from 'path';
import { AppError } from './errors.js';

const FIRMAS = [
  { mime: 'image/jpeg', ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', ext: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

function esWebp(buffer) {
  return buffer.length > 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}

export function identificarArchivo(buffer) {
  if (esWebp(buffer)) return { mime: 'image/webp', ext: '.webp' };
  return FIRMAS.find((firma) => firma.bytes.every((byte, indice) => buffer[indice] === byte)) || null;
}

export function validarArchivo(archivo, maxBytes) {
  if (!archivo?.buffer?.length) {
    throw new AppError(422, 'Debe adjuntar un archivo', 'ARCHIVO');
  }
  if (archivo.size > maxBytes) {
    throw new AppError(422, 'El archivo supera el tamaño permitido', 'ARCHIVO');
  }
  const identificado = identificarArchivo(archivo.buffer);
  if (!identificado) {
    throw new AppError(422, 'Solo se permiten imágenes JPG, PNG, WEBP o documentos PDF', 'ARCHIVO');
  }
  const original = path.basename(archivo.originalname || 'archivo').slice(0, 180);
  return { ...identificado, nombreOriginal: original, tamano: archivo.size };
}
