export function metaLista(total, pagina, tamano) {
  return {
    pagina,
    tamano,
    total,
    paginas: total === 0 ? 0 : Math.ceil(total / tamano),
  };
}

export function salto(pagina, tamano) {
  return (pagina - 1) * tamano;
}

export function contiene(q) {
  const texto = q?.trim();
  if (!texto) return undefined;
  return { contains: texto, mode: 'insensitive' };
}
