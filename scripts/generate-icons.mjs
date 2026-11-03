import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(tipo, datos) {
  const tipoBuffer = Buffer.from(tipo);
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipoBuffer, datos])));
  return Buffer.concat([longitud, tipoBuffer, datos, crc]);
}

function png(tamano) {
  const fila = tamano * 4 + 1;
  const raw = Buffer.alloc(fila * tamano);
  for (let y = 0; y < tamano; y += 1) {
    const inicio = y * fila;
    raw[inicio] = 0;
    for (let x = 0; x < tamano; x += 1) {
      const i = inicio + 1 + x * 4;
      const dx = x - tamano / 2;
      const dy = y - tamano / 2;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      let r = 11; let g = 31; let b = 58;
      if (distancia < tamano * 0.34) { r = 255; g = 255; b = 255; }
      if (distancia < tamano * 0.27) { r = 11; g = 31; b = 58; }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamano, 0);
  ihdr.writeUInt32BE(tamano, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const destino = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/public/icons');
fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(path.join(destino, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(destino, 'icon-512.png'), png(512));
console.log('Iconos PWA generados');
