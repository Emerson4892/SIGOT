import { createContext, useContext, useState } from 'react';

const NotifyContext = createContext(() => {});

export function NotifyProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  function notificar(mensaje, tipo = 'success') {
    const id = crypto.randomUUID();
    setAvisos((lista) => [...lista, { id, mensaje, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((aviso) => aviso.id !== id)), 4200);
  }
  return (
    <NotifyContext.Provider value={notificar}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`toast show text-bg-${aviso.tipo === 'error' ? 'danger' : aviso.tipo === 'warning' ? 'warning' : 'success'}`} role="status">
            <div className={`toast-body ${aviso.tipo === 'warning' ? 'text-dark' : ''}`}>{aviso.mensaje}</div>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}
