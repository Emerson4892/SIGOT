export function aCsv(filas) {
  const texto = filas.map((fila) => fila.map((celda) => {
    const valor = celda == null ? '' : String(celda);
    return `"${valor.replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
  return `\uFEFF${texto}`;
}
