import { z } from 'zod';
import { idParams } from './comun.js';

export const permisosRolSchema = z.object({
  body: z.object({
    permisos: z.array(z.string().trim().min(3)).min(1),
  }),
  query: z.object({}).default({}),
  params: idParams,
});
