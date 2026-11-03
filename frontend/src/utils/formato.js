export function fecha(valor) {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor));
}

export const ESTADOS = {
  OPERATIVO: ['Operativo', 'success'],
  CON_FALLA: ['Con falla', 'danger'],
  EN_MANTENIMIENTO: ['En mantenimiento', 'warning'],
  FUERA_DE_SERVICIO: ['Fuera de servicio', 'dark'],
  RETIRADO: ['Retirado', 'secondary'],
  ABIERTO: ['Abierto', 'warning'],
  CONVERTIDO: ['Convertido', 'info'],
  CERRADO: ['Cerrado', 'success'],
  CANCELADO: ['Cancelado', 'secondary'],
  PENDIENTE: ['Pendiente', 'secondary'],
  ASIGNADA: ['Asignada', 'info'],
  ACEPTADA: ['Aceptada', 'primary'],
  EN_PROCESO: ['En proceso', 'warning'],
  PENDIENTE_APROBACION: ['Pendiente de aprobación', 'dark'],
  FINALIZADA: ['Finalizada', 'success'],
  RECHAZADA: ['Rechazada', 'danger'],
  CANCELADA: ['Cancelada', 'secondary'],
  BAJA: ['Baja', 'secondary'],
  MEDIA: ['Media', 'info'],
  ALTA: ['Alta', 'warning'],
  CRITICA: ['Crítica', 'danger'],
  ACTIVO: ['Activo', 'success'],
  INACTIVO: ['Inactivo', 'secondary'],
  PROGRAMADO: ['Programado', 'info'],
  ORDEN_GENERADA: ['Orden generada', 'primary'],
  COMPLETADO: ['Completado', 'success'],
  APROBADA: ['Aprobada', 'success'],
  UTILIZADO: ['Utilizado', 'secondary'],
  EXPIRADO: ['Expirado', 'warning'],
  REVOCADO: ['Revocado', 'danger'],
};

export function etiqueta(codigo) {
  return ESTADOS[codigo]?.[0] || codigo || '—';
}

export function tono(codigo) {
  return ESTADOS[codigo]?.[1] || 'secondary';
}

export function inicioDe(usuario) {
  const codigos = (usuario?.roles || []).map((rol) => rol.codigo);
  if (codigos.length === 1 && codigos[0] === 'TECNICO') return '/tecnico';
  if (codigos.length === 1 && codigos[0] === 'BODEGA') return '/repuestos';
  return '/';
}

export function tiene(usuario, permiso) {
  return Boolean(usuario?.permisos?.includes(permiso));
}
