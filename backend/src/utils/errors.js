export class AppError extends Error {
  constructor(status, mensaje, codigo = 'ERROR', detalles = undefined) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export function esAppError(error) {
  return error instanceof AppError;
}
