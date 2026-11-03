import { AppError } from '../utils/errors.js';

export function validar(esquema) {
  return (req, _res, next) => {
    const resultado = esquema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });
    if (!resultado.success) {
      return next(new AppError(422, 'Los datos enviados no son válidos', 'VALIDACION', resultado.error.flatten()));
    }
    req.valid = resultado.data;
    next();
  };
}
