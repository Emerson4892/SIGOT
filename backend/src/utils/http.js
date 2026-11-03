export function contexto(req) {
  return {
    ip: req.ip || null,
    agente: req.get('user-agent') || null,
  };
}

export function claveIdempotencia(req) {
  const clave = req.get('x-idempotency-key');
  if (!clave) return null;
  if (!/^[0-9a-f-]{36}$/i.test(clave) && !/^[A-Za-z0-9_-]{8,80}$/.test(clave)) {
    return null;
  }
  return clave;
}
