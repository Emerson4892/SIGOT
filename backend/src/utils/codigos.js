export async function siguienteCodigo(tx, prefijo) {
  const fila = await tx.secuencia.upsert({
    where: { nombre: prefijo },
    create: { nombre: prefijo, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  const anio = new Date().getFullYear();
  return `${prefijo}-${anio}-${String(fila.valor).padStart(4, '0')}`;
}
