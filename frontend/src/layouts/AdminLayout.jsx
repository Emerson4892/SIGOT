import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth, useSalir } from '../contexts/AuthContext.jsx';
import { tiene } from '../utils/formato.js';

const MENU = [
  ['/', 'bi-speedometer2', 'Tablero', 'dashboard.leer'],
  ['/usuarios', 'bi-people', 'Usuarios', 'usuarios.leer'],
  ['/roles', 'bi-shield-lock', 'Roles', 'roles.leer'],
  ['/clientes', 'bi-building', 'Clientes', 'clientes.leer'],
  ['/ubicaciones', 'bi-geo-alt', 'Ubicaciones', 'ubicaciones.leer'],
  ['/tipos-activo', 'bi-tags', 'Tipos de activo', 'tipos_activo.leer'],
  ['/activos', 'bi-hdd-rack', 'Activos', 'activos.leer'],
  ['/incidentes', 'bi-exclamation-triangle', 'Incidentes', 'incidentes.leer'],
  ['/ordenes', 'bi-clipboard-check', 'Órdenes', 'ordenes.leer'],
  ['/sla', 'bi-clock-history', 'SLA', 'sla.leer'],
  ['/tecnicos', 'bi-person-gear', 'Técnicos', 'tecnicos.leer'],
  ['/cuadrillas', 'bi-diagram-3', 'Cuadrillas', 'cuadrillas.leer'],
  ['/repuestos', 'bi-box-seam', 'Repuestos', 'repuestos.leer'],
  ['/movimientos', 'bi-arrow-left-right', 'Movimientos', 'movimientos.leer'],
  ['/checklists', 'bi-list-check', 'Checklists', 'checklists.leer'],
  ['/mantenimientos', 'bi-calendar2-check', 'Mantenimientos', 'mantenimientos.leer'],
  ['/aprobaciones', 'bi-patch-check', 'Aprobaciones', 'aprobaciones.leer'],
  ['/reportes', 'bi-bar-chart', 'Reportes', 'reportes.leer'],
  ['/auditoria', 'bi-journal-text', 'Auditoría', 'auditoria.leer'],
  ['/configuracion', 'bi-sliders', 'Configuración', 'configuracion.leer'],
];

export function AdminLayout() {
  const { usuario } = useAuth();
  const { salir, dialogo } = useSalir();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [avisos, setAvisos] = useState({ datos: [], noLeidas: 0 });

  async function cargarAvisos() {
    const { data } = await api.get('/notificaciones').catch(() => ({ data: { datos: [], noLeidas: 0 } }));
    setAvisos(data);
  }

  useEffect(() => {
    cargarAvisos();
    const timer = setInterval(cargarAvisos, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <aside className={`sidebar ${abierto ? 'show' : ''}`}>
        <div className="brand">SIGOT<small>Operaciones técnicas</small></div>
        <nav className="py-2">
          {MENU.filter((item) => tiene(usuario, item[3])).map(([ruta, icono, texto]) => (
            <NavLink key={ruta} to={ruta} end={ruta === '/'} onClick={() => setAbierto(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              <i className={`bi ${icono}`} /> {texto}
            </NavLink>
          ))}
          {tiene(usuario, 'ordenes.leer_asignadas') && (
            <NavLink to="/tecnico" onClick={() => setAbierto(false)}><i className="bi bi-phone" /> Modo campo</NavLink>
          )}
        </nav>
      </aside>
      {abierto && <div className="backdrop d-lg-none" onClick={() => setAbierto(false)} />}
      <div className="shell">
        <header className="topbar">
          <button type="button" className="btn btn-outline-secondary d-lg-none" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <i className="bi bi-list" />
          </button>
          <div className="dropdown ms-auto">
            <button className="btn btn-light position-relative me-2" data-bs-toggle="dropdown" aria-label="Notificaciones">
              <i className="bi bi-bell" />
              {avisos.noLeidas > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">{avisos.noLeidas}</span>}
            </button>
            <div className="dropdown-menu dropdown-menu-end p-2" style={{ width: 320 }}>
              {avisos.datos.length === 0 && <div className="text-secondary small px-2">Sin notificaciones</div>}
              {avisos.datos.slice(0, 6).map((aviso) => (
                <button key={aviso.id} type="button" className="dropdown-item text-wrap" onClick={async () => {
                  await api.post(`/notificaciones/${aviso.id}/leida`);
                  if (aviso.enlace) navegar(aviso.enlace);
                  cargarAvisos();
                }}>
                  <strong className="d-block">{aviso.titulo}</strong>
                  <span className="small text-secondary">{aviso.mensaje}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="dropdown">
            <button className="btn btn-light dropdown-toggle" data-bs-toggle="dropdown">
              {usuario?.nombre} {usuario?.apellido}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><button className="dropdown-item" type="button" onClick={() => navegar('/perfil')}>Perfil</button></li>
              <li><button className="dropdown-item" type="button" onClick={() => navegar('/cambiar-clave')}>Cambiar contraseña</button></li>
              <li><button className="dropdown-item" type="button" onClick={salir}>Cerrar sesión</button></li>
            </ul>
          </div>
        </header>
        {dialogo}
        <main className="content"><Outlet /></main>
      </div>
    </>
  );
}
