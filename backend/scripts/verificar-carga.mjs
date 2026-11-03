import { prisma } from '../src/config/db.js';
import { crearApp } from '../src/app.js';

crearApp();
const usuarios = await prisma.usuario.count();
const permisos = await prisma.permiso.count();
const roles = await prisma.rol.count();
console.log(JSON.stringify({ usuarios, permisos, roles }));
await prisma.$disconnect();
