import { Router } from 'express';
import * as controlador from '../controllers/authController.js';
import { autenticar } from '../middlewares/auth.js';
import { exigirClaveActualizada } from '../middlewares/authorize.js';
import { csrf, verificarOrigen } from '../middlewares/csrf.js';
import { limiteLogin, limiteRecuperacion } from '../middlewares/rateLimit.js';
import { validar } from '../middlewares/validate.js';
import { cambiarClaveSchema, loginSchema, recuperarSchema, restablecerSchema, revocarSesionSchema } from '../validators/auth.js';

const router = Router();

router.post('/login', limiteLogin, validar(loginSchema), controlador.login);
router.post('/refresh', verificarOrigen, controlador.refrescar);
router.post('/logout', controlador.logout);
router.post('/recuperar', limiteRecuperacion, validar(recuperarSchema), controlador.recuperar);
router.post('/restablecer', validar(restablecerSchema), controlador.restablecer);
router.get('/perfil', autenticar, exigirClaveActualizada, controlador.perfil);
router.post('/cambiar-clave', autenticar, exigirClaveActualizada, csrf, validar(cambiarClaveSchema), controlador.cambiarClave);
router.get('/sesiones', autenticar, exigirClaveActualizada, controlador.sesiones);
router.delete('/sesiones/:id', autenticar, exigirClaveActualizada, csrf, validar(revocarSesionSchema), controlador.revocarSesion);

export default router;
