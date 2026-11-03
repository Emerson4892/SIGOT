import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { includeUsuario, mapUsuario } from '../repositories/usuarioRepository.js';
import { COOKIES } from '../utils/cookies.js';
import { AppError } from '../utils/errors.js';

export async function autenticar(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIES.access];
    if (!token) throw new AppError(401, 'Debe iniciar sesión', 'NO_AUTENTICADO');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new AppError(401, 'La sesión expiró', 'SESION_EXPIRADA');
    }

    const sesion = await prisma.sesion.findUnique({ where: { id: payload.sid } });
    if (!sesion || sesion.revocadaEn || sesion.usuarioId !== payload.sub || sesion.expiraEn < new Date()) {
      throw new AppError(401, 'La sesión no es válida', 'SESION_INVALIDA');
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: includeUsuario,
    });
    if (!usuario || !usuario.activo) {
      throw new AppError(401, 'El usuario no está disponible', 'USUARIO_INACTIVO');
    }

    const publico = mapUsuario(usuario);
    req.user = { ...publico, csrfToken: sesion.csrfToken, sesionId: sesion.id };
    next();
  } catch (error) {
    next(error);
  }
}
