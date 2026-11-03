import { z } from 'zod';

export const consultaLista = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(120).optional().default(''),
});

export function esquemaLista(queryExtra = {}) {
  return z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: consultaLista.extend(queryExtra),
  });
}

export const idParams = z.object({
  id: z.string().uuid('Identificador inválido'),
});

export function esquemaId() {
  return z.object({
    body: z.object({}).default({}),
    params: idParams,
    query: z.object({}).default({}),
  });
}

export const claveSchema = z.string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir un símbolo');

export const correoSchema = z.string().trim().email('Correo inválido').transform((valor) => valor.toLowerCase());

export const prioridadSchema = z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']);
