import { z } from 'zod';
import { claveSchema, correoSchema, esquemaId, esquemaLista, idParams } from './comun.js';

export const listarUsuariosSchema = esquemaLista({
  activo: z.enum(['true', 'false', '']).optional().default(''),
});

const datosUsuario = {
  nombre: z.string().trim().min(2).max(80),
  apellido: z.string().trim().min(2).max(80),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  roles: z.array(z.string().trim().min(2)).min(1, 'Asigne al menos un rol'),
};

export const crearUsuarioSchema = z.object({
  body: z.object({
    correo: correoSchema,
    contrasena: claveSchema,
    ...datosUsuario,
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const editarUsuarioSchema = z.object({
  body: z.object({
    nombre: datosUsuario.nombre,
    apellido: datosUsuario.apellido,
    telefono: datosUsuario.telefono,
  }),
  query: z.object({}).default({}),
  params: idParams,
});

export const rolesUsuarioSchema = z.object({
  body: z.object({ roles: datosUsuario.roles }),
  query: z.object({}).default({}),
  params: idParams,
});

export const usuarioIdSchema = esquemaId();
