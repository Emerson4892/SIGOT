import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useSalir } from '../contexts/AuthContext.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { resumenCola } from '../pwa/syncQueue.js';
import { leerCola } from '../pwa/db.js';
import { sincronizarCola } from '../pwa/sync.js';

export function TecnicoLayout() {
  const { usuario } = useAuth();
  const { salir, dialogo } = useSalir();
  const notificar = useNotify();
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [cola, setCola] = useState({ pendientes: 0, errores: 0, total: 0 });
  const [instalacion, setInstalacion] = useState(null);

  async function refrescarCola() {
    setCola(resumenCola(await leerCola().catch(() => [])));
  }

  useEffect(() => {
    const en = () => setEnLinea(true);
    const fuera = () => setEnLinea(false);
    const prompt = (evento) => { evento.preventDefault(); setInstalacion(evento); };
    window.addEventListener('online', en);
    window.addEventListener('offline', fuera);
    window.addEventListener('beforeinstallprompt', prompt);
    refrescarCola();
    return () => {
      window.removeEventListener('online', en);
      window.removeEventListener('offline', fuera);
      window.removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);

  useEffect(() => {
    if (!enLinea || !usuario?.id) return;
    sincronizarCola({ usuarioId: usuario.id, notificar }).finally(refrescarCola);
  }, [enLinea, usuario?.id]);

  return (
    <div className="tech-shell">
      {!enLinea && <div className="offline-banner px-3 py-2 small">Sin conexión. Las operaciones de campo quedarán en la cola de sincronización.</div>}
      <header className="d-flex justify-content-between align-items-center px-3 py-3 bg-white border-bottom">
        <div>
          <strong>SIGOT</strong>
          <div className="small text-secondary">{usuario?.nombre} {usuario?.apellido}</div>
        </div>
        <div className="d-flex gap-2">
          {instalacion && <button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => { instalacion.prompt(); setInstalacion(null); }}>Instalar</button>}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={salir}>Salir</button>
        </div>
      </header>
      {dialogo}
      {cola.total > 0 && <div className="px-3 py-2 small">{cola.pendientes} pendientes · {cola.errores} con error</div>}
      <main className="p-3"><Outlet context={{ refrescarCola, enLinea }} /></main>
      <nav className="tech-nav">
        <NavLink to="/tecnico" end><i className="bi bi-house" />Inicio</NavLink>
        <NavLink to="/tecnico/ordenes"><i className="bi bi-clipboard" />Órdenes</NavLink>
        <NavLink to="/tecnico/historial"><i className="bi bi-clock-history" />Historial</NavLink>
        <NavLink to="/tecnico/sincronizacion"><i className="bi bi-arrow-repeat" />Sincronizar</NavLink>
      </nav>
    </div>
  );
}
