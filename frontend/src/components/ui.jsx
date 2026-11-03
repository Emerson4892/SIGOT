import { useEffect, useState } from 'react';
import { etiqueta, tono } from '../utils/formato.js';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-secondary py-4">
      <div className="spinner-border spinner-border-sm" role="status" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ texto }) {
  return <div className="text-secondary py-4 text-center">{texto}</div>;
}

export function Alerta({ tipo = 'danger', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${tipo} d-flex justify-content-between`} role="alert">
      <span>{children}</span>
      {onClose && <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />}
    </div>
  );
}

export function Estado({ codigo }) {
  return <span className={`badge text-bg-${tono(codigo)}`}>{etiqueta(codigo)}</span>;
}

export function Paginacion({ meta, onChange }) {
  if (!meta || meta.paginas <= 1) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <small className="text-secondary">{meta.total} registros</small>
      <div className="btn-group">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={meta.pagina <= 1} onClick={() => onChange(meta.pagina - 1)}>Anterior</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled>{meta.pagina} / {meta.paginas}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={meta.pagina >= meta.paginas} onClick={() => onChange(meta.pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

export function Modal({ titulo, abierto, onClose, children }) {
  if (!abierto) return null;
  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">{titulo}</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
            </div>
            {children}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

export function useConfirmar() {
  const [estado, setEstado] = useState(null);
  const confirmar = (mensaje) => new Promise((resolver) => {
    setEstado({ mensaje, resolver });
  });
  const dialogo = estado ? (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-body">
              <p className="mb-0">{estado.mensaje}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={() => { estado.resolver(false); setEstado(null); }}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => { estado.resolver(true); setEstado(null); }}>Confirmar</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  ) : null;
  return { confirmar, dialogo };
}

export function Busqueda({ valor, onChange, placeholder = 'Buscar' }) {
  const [local, setLocal] = useState(valor || '');
  useEffect(() => {
    const timer = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(timer);
  }, [local, onChange]);
  return (
    <input className="form-control" value={local} placeholder={placeholder} onChange={(evento) => setLocal(evento.target.value)} />
  );
}
