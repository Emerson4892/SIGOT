import { Router } from 'express';
import * as controlador from '../controllers/usuarioController.js';
import { autenticar } from '../middlewares/auth.js';
import { exigirClaveActualizada, requirePermission } from '../middlewares/authorize.js';
import { csrf } from '../middlewares/csrf.js';
import { validar } from '../middlewares/validate.js';
import { crearUsuarioSchema, editarUsuarioSchema, listarUsuariosSchema, rolesUsuarioSchema, usuarioIdSchema } from '../validators/usuarios.js';

const router = Router();
router.use(autenticar, exigirClaveActualizada, csrf);

router.get('/', requirePermission('usuarios.leer'), validar(listarUsuariosSchema), controlador.listar);
router.post('/', requirePermission('usuarios.escribir'), validar(crearUsuarioSchema), controlador.crear);
router.patch('/:id', requirePermission('usuarios.escribir'), validar(editarUsuarioSchema), controlador.actualizar);
router.put('/:id/roles', requirePermission('usuarios.escribir'), validar(rolesUsuarioSchema), controlador.asignarRoles);
router.post('/:id/desactivar', requirePermission('usuarios.desactivar'), validar(usuarioIdSchema), controlador.desactivar);
router.post('/:id/activar', requirePermission('usuarios.desactivar'), validar(usuarioIdSchema), controlador.activar);

export default router;
