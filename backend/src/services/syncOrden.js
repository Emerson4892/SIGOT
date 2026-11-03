export const PRIORIDAD_SYNC = {
  CHECKLIST: 1,
  DIAGNOSTICO: 2,
  SOLUCION: 3,
  REPUESTOS: 4,
  SOLICITAR_CIERRE: 5,
};

export const PREVIAS_CIERRE = ['CHECKLIST', 'DIAGNOSTICO', 'SOLUCION'];

export function ordenarOperaciones(operaciones) {
  return [...operaciones].sort((a, b) => {
    const orden = String(a.ordenId).localeCompare(String(b.ordenId));
    if (orden !== 0) return orden;
    const prioridad = (PRIORIDAD_SYNC[a.tipo] ?? 99) - (PRIORIDAD_SYNC[b.tipo] ?? 99);
    if (prioridad !== 0) return prioridad;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function cuerpoInvalido(item) {
  const cuerpo = item.cuerpo || {};
  if (item.tipo === 'DIAGNOSTICO' && typeof cuerpo.diagnostico !== 'string') return 'Falta el diagnóstico';
  if (item.tipo === 'SOLUCION' && typeof cuerpo.solucion !== 'string') return 'Falta la solución';
  if (item.tipo === 'CHECKLIST' && !cuerpo.plantillaId) return 'Falta el checklist';
  if (item.tipo === 'REPUESTOS' && !Array.isArray(cuerpo.items)) return 'Faltan los repuestos';
  return null;
}
