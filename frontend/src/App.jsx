import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { Cargando } from './components/ui.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';
import { TecnicoLayout } from './layouts/TecnicoLayout.jsx';
import { CambiarClave, Login, Perfil, Recuperar, Restablecer, SinAcceso } from './pages/Auth.jsx';
import { Activos, HistorialActivo } from './pages/Activos.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Auditoria, Clientes, Configuracion, Cuadrillas, HistorialTecnico, InicioTecnico, Reportes, Repuestos, Sincronizacion, Sla, Tecnicos, TiposActivo, Ubicaciones } from './pages/Gestion.jsx';
import { Incidentes } from './pages/Incidentes.jsx';
import { Aprobaciones, Checklists, Mantenimientos, Movimientos } from './pages/Inventario.jsx';
import { Ordenes } from './pages/Ordenes.jsx';
import { DetalleOrden } from './pages/DetalleOrden.jsx';
import { Roles, Usuarios } from './pages/Usuarios.jsx';
import { inicioDe, tiene } from './utils/formato.js';

function Sesion({ children, permiso, campo = false }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.debeCambiarClave && location.pathname !== '/cambiar-clave') return <Navigate to="/cambiar-clave" replace />;
  if (permiso && !tiene(usuario, permiso)) return <Navigate to="/sin-acceso" replace />;
  if (campo && !tiene(usuario, 'ordenes.trabajar') && !tiene(usuario, 'ordenes.leer_asignadas')) return <Navigate to="/sin-acceso" replace />;
  return children;
}

function Permiso({ permiso, alguno, children }) {
  const { usuario } = useAuth();
  const permitido = alguno
    ? alguno.some((codigo) => tiene(usuario, codigo))
    : tiene(usuario, permiso);
  if (!permitido) return <Navigate to="/sin-acceso" replace />;
  return children;
}

function Inicio() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={inicioDe(usuario)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/restablecer" element={<Restablecer />} />
      <Route path="/cambiar-clave" element={<Sesion><CambiarClave /></Sesion>} />
      <Route path="/tecnico" element={<Sesion campo><TecnicoLayout /></Sesion>}>
        <Route index element={<InicioTecnico />} />
        <Route path="ordenes" element={<Ordenes base="/tecnico/ordenes" tecnico />} />
        <Route path="ordenes/:id" element={<DetalleOrden />} />
        <Route path="historial" element={<HistorialTecnico />} />
        <Route path="sincronizacion" element={<Sincronizacion />} />
      </Route>
      <Route element={<Sesion><AdminLayout /></Sesion>}>
        <Route path="/" element={<Permiso permiso="dashboard.leer"><Dashboard /></Permiso>} />
        <Route path="/usuarios" element={<Permiso permiso="usuarios.leer"><Usuarios /></Permiso>} />
        <Route path="/roles" element={<Permiso permiso="roles.leer"><Roles /></Permiso>} />
        <Route path="/clientes" element={<Permiso permiso="clientes.leer"><Clientes /></Permiso>} />
        <Route path="/ubicaciones" element={<Permiso permiso="ubicaciones.leer"><Ubicaciones /></Permiso>} />
        <Route path="/tipos-activo" element={<Permiso permiso="tipos_activo.leer"><TiposActivo /></Permiso>} />
        <Route path="/activos" element={<Permiso permiso="activos.leer"><Activos /></Permiso>} />
        <Route path="/activos/:id" element={<Permiso permiso="historial.leer"><HistorialActivo /></Permiso>} />
        <Route path="/incidentes" element={<Permiso permiso="incidentes.leer"><Incidentes /></Permiso>} />
        <Route path="/ordenes" element={<Permiso alguno={['ordenes.leer', 'ordenes.leer_asignadas']}><Ordenes /></Permiso>} />
        <Route path="/ordenes/:id" element={<Permiso alguno={['ordenes.leer', 'ordenes.leer_asignadas']}><DetalleOrden /></Permiso>} />
        <Route path="/sla" element={<Permiso permiso="sla.leer"><Sla /></Permiso>} />
        <Route path="/tecnicos" element={<Permiso permiso="tecnicos.leer"><Tecnicos /></Permiso>} />
        <Route path="/cuadrillas" element={<Permiso permiso="cuadrillas.leer"><Cuadrillas /></Permiso>} />
        <Route path="/repuestos" element={<Permiso permiso="repuestos.leer"><Repuestos /></Permiso>} />
        <Route path="/movimientos" element={<Permiso permiso="movimientos.leer"><Movimientos /></Permiso>} />
        <Route path="/checklists" element={<Permiso permiso="checklists.leer"><Checklists /></Permiso>} />
        <Route path="/mantenimientos" element={<Permiso permiso="mantenimientos.leer"><Mantenimientos /></Permiso>} />
        <Route path="/aprobaciones" element={<Permiso permiso="aprobaciones.leer"><Aprobaciones /></Permiso>} />
        <Route path="/reportes" element={<Permiso permiso="reportes.leer"><Reportes /></Permiso>} />
        <Route path="/auditoria" element={<Permiso permiso="auditoria.leer"><Auditoria /></Permiso>} />
        <Route path="/configuracion" element={<Permiso permiso="configuracion.leer"><Configuracion /></Permiso>} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/sin-acceso" element={<SinAcceso />} />
      </Route>
      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
