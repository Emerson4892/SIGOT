import { AppError } from '../utils/errors.js';

export function soloAsignadas(usuario) {
  return usuario.permisos.includes('ordenes.leer_asignadas') && !usuario.permisos.includes('ordenes.leer');
}

export function filtroAsignadas(tecnicoId) {
  return {
    OR: [
      { tecnicoId },
      { asignaciones: { some: { tecnicoId, estado: { in: ['PENDIENTE', 'ACEPTADA'] } } } },
      { cuadrilla: { miembros: { some: { tecnicoId } } } },
    ],
  };
}

export function ordenVisible(usuario, orden) {
  if (!soloAsignadas(usuario)) return true;
  if (!usuario.tecnicoId) return false;
  if (orden.tecnicoId === usuario.tecnicoId) return true;
  if ((orden.asignaciones || []).some((item) => item.tecnicoId === usuario.tecnicoId && ['PENDIENTE', 'ACEPTADA'].includes(item.estado))) {
    return true;
  }
  return Boolean(orden.cuadrilla?.miembros?.some((item) => item.tecnicoId === usuario.tecnicoId));
}

export function exigirVisible(usuario, orden) {
  if (!orden || !ordenVisible(usuario, orden)) {
    throw new AppError(404, 'Orden no encontrada', 'NO_ENCONTRADO');
  }
}

export function exigirEjecutor(usuario, orden) {
  exigirVisible(usuario, orden);
  if (!usuario.permisos.includes('ordenes.trabajar') || orden.tecnicoId !== usuario.tecnicoId) {
    throw new AppError(403, 'La orden no está asignada a este técnico', 'ORDEN_AJENA');
  }
}
