import { Router } from 'express';
import * as controlador from '../controllers/rolController.js';
import { autenticar } from '../middlewares/auth.js';
import { exigirClaveActualizada, requirePermission } from '../middlewares/authorize.js';
import { csrf } from '../middlewares/csrf.js';
import { validar } from '../middlewares/validate.js';
import { permisosRolSchema } from '../validators/roles.js';

const router = Router();
router.use(autenticar, exigirClaveActualizada, csrf);
router.get('/', requirePermission('roles.leer'), controlador.listar);
router.get('/permisos', requirePermission('permisos.leer'), controlador.permisos);
router.put('/:id/permisos', requirePermission('roles.escribir'), validar(permisosRolSchema), controlador.actualizarPermisos);

export default router;
