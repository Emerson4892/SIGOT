import { z } from 'zod';
import { claveSchema, correoSchema, idParams } from './comun.js';

export const loginSchema = z.object({
  body: z.object({
    correo: correoSchema,
    contrasena: z.string().min(1, 'La contraseña es obligatoria'),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const recuperarSchema = z.object({
  body: z.object({ correo: correoSchema }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const restablecerSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    contrasena: claveSchema,
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const cambiarClaveSchema = z.object({
  body: z.object({
    contrasenaActual: z.string().min(1),
    contrasenaNueva: claveSchema,
  }).refine((datos) => datos.contrasenaActual !== datos.contrasenaNueva, {
    message: 'La contraseña nueva debe ser distinta a la actual',
    path: ['contrasenaNueva'],
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const revocarSesionSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: idParams,
});
