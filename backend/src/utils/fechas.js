export function sumarMinutos(fecha, minutos) {
  return new Date(fecha.getTime() + minutos * 60 * 1000);
}

export function sumarFrecuencia(fecha, frecuencia) {
  const resultado = new Date(fecha);
  if (frecuencia === 'DIARIA') resultado.setDate(resultado.getDate() + 1);
  if (frecuencia === 'SEMANAL') resultado.setDate(resultado.getDate() + 7);
  if (frecuencia === 'MENSUAL') resultado.setMonth(resultado.getMonth() + 1);
  if (frecuencia === 'TRIMESTRAL') resultado.setMonth(resultado.getMonth() + 3);
  if (frecuencia === 'SEMESTRAL') resultado.setMonth(resultado.getMonth() + 6);
  if (frecuencia === 'ANUAL') resultado.setFullYear(resultado.getFullYear() + 1);
  return resultado;
}
