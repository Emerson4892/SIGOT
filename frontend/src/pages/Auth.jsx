import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api, mensajeError } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Alerta } from '../components/ui.jsx';
import { fecha, inicioDe } from '../utils/formato.js';

function Marco({ titulo, children }) {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="card-body p-4">
          <div className="mb-3">
            <div className="fw-bold fs-4 text-primary">SIGOT</div>
            <div className="text-secondary">Sistema Integral de Gestión de Operaciones Técnicas</div>
          </div>
          <h1 className="h4">{titulo}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navegar = useNavigate();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(datos) {
    setCargando(true);
    setError('');
    try {
      const usuario = await login(datos.correo, datos.contrasena);
      navegar(usuario.debeCambiarClave ? '/cambiar-clave' : inicioDe(usuario));
    } catch (errorLogin) {
      setError(mensajeError(errorLogin));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco titulo="Iniciar sesión">
      <Alerta>{error}</Alerta>
      <form onSubmit={handleSubmit(enviar)} className="d-grid gap-3">
        <div><label className="form-label">Correo</label><input className="form-control" type="email" {...register('correo', { required: true })} /></div>
        <div><label className="form-label">Contraseña</label><input className="form-control" type="password" {...register('contrasena', { required: true })} /></div>
        <button className="btn btn-primary" disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
        <Link to="/recuperar">Recuperar contraseña</Link>
      </form>
    </Marco>
  );
}

export function Recuperar() {
  const { register, handleSubmit } = useForm();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  return (
    <Marco titulo="Recuperar contraseña">
      <Alerta tipo="success">{mensaje}</Alerta>
      <Alerta>{error}</Alerta>
      <form className="d-grid gap-3" onSubmit={handleSubmit(async (datos) => {
        setError('');
        try {
          const { data } = await api.post('/auth/recuperar', datos);
          setMensaje(data.mensaje);
        } catch (errorEnvio) {
          setError(mensajeError(errorEnvio));
        }
      })}>
        <div><label className="form-label">Correo</label><input className="form-control" type="email" {...register('correo', { required: true })} /></div>
        <button className="btn btn-primary">Generar enlace</button>
        <Link to="/login">Volver al inicio de sesión</Link>
      </form>
    </Marco>
  );
}

export function Restablecer() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState('');
  return (
    <Marco titulo="Nueva contraseña">
      <Alerta>{error}</Alerta>
      <form className="d-grid gap-3" onSubmit={handleSubmit(async (datos) => {
        try {
          await api.post('/auth/restablecer', { token: params.get('token'), contrasena: datos.contrasena });
          navegar('/login');
        } catch (errorEnvio) {
          setError(mensajeError(errorEnvio));
        }
      })}>
        <div><label className="form-label">Contraseña nueva</label><input className="form-control" type="password" {...register('contrasena', { required: true })} /></div>
        <button className="btn btn-primary">Guardar</button>
      </form>
    </Marco>
  );
}

export function CambiarClave() {
  const { register, handleSubmit } = useForm();
  const { recargar } = useAuth();
  const navegar = useNavigate();
  const [error, setError] = useState('');
  return (
    <Marco titulo="Cambiar contraseña">
      <Alerta>{error}</Alerta>
      <form className="d-grid gap-3" onSubmit={handleSubmit(async (datos) => {
        try {
          await api.post('/auth/cambiar-clave', datos);
          await recargar();
          navegar('/');
        } catch (errorEnvio) {
          setError(mensajeError(errorEnvio));
        }
      })}>
        <div><label className="form-label">Contraseña actual</label><input className="form-control" type="password" {...register('contrasenaActual', { required: true })} /></div>
        <div><label className="form-label">Contraseña nueva</label><input className="form-control" type="password" {...register('contrasenaNueva', { required: true })} /></div>
        <button className="btn btn-primary">Actualizar</button>
      </form>
    </Marco>
  );
}

export function Perfil() {
  const { usuario } = useAuth();
  const [sesiones, setSesiones] = useState([]);
  async function cargar() {
    const { data } = await api.get('/auth/sesiones');
    setSesiones(data.datos || []);
  }
  useEffect(() => { cargar().catch(() => {}); }, []);
  return (
    <div className="d-grid gap-3">
      <div className="card"><div className="card-body">
        <h1 className="h4">Perfil</h1>
        <p className="mb-1"><strong>{usuario?.nombre} {usuario?.apellido}</strong></p>
        <p className="mb-1">{usuario?.correo}</p>
        <p className="mb-0">Roles: {(usuario?.roles || []).map((rol) => rol.nombre).join(', ')}</p>
      </div></div>
      <div className="card"><div className="card-body">
        <h2 className="h5">Sesiones</h2>
        {sesiones.length === 0 ? <p className="text-secondary mb-0">No hay sesiones activas para mostrar.</p> : (
          <ul className="list-group list-group-flush">{sesiones.map((sesion) => (
            <li key={sesion.id} className="list-group-item d-flex justify-content-between align-items-center gap-3">
              <span><span className="d-block">{sesion.agente || 'Navegador'}</span><span className="small text-secondary">{fecha(sesion.creadoEn)} · {sesion.ip || 'IP no registrada'}</span></span>
              {sesion.actual ? <span className="badge text-bg-primary">Esta sesión</span> : (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={async () => { await api.delete(`/auth/sesiones/${sesion.id}`); cargar(); }}>Revocar</button>
              )}
            </li>
          ))}</ul>
        )}
      </div></div>
    </div>
  );
}

export function SinAcceso() {
  return <div className="alert alert-warning">No tiene permiso para ver esta sección.</div>;
}
