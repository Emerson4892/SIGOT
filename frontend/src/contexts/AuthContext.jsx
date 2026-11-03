import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { setCsrf } from '../services/csrf.js';
import { activarUsuario, contarPendientes, limpiarSesionLocal } from '../pwa/db.js';
import { useConfirmar } from '../components/ui.jsx';
import axios from 'axios';

const AuthContext = createContext(null);
const plano = axios.create({ baseURL: '/api', withCredentials: true });

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  async function aplicar(data) {
    setCsrf(data.csrfToken);
    await activarUsuario(data.usuario.id);
    setUsuario(data.usuario);
  }

  async function cargar() {
    try {
      const { data } = await api.get('/auth/perfil');
      await aplicar(data);
    } catch {
      try {
        const { data } = await plano.post('/auth/refresh');
        await aplicar(data);
      } catch {
        setUsuario(null);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    const expirada = () => {
      limpiarSesionLocal().catch(() => {});
      setCsrf('');
      setUsuario(null);
    };
    window.addEventListener('sigot:sesion-expirada', expirada);
    return () => window.removeEventListener('sigot:sesion-expirada', expirada);
  }, []);

  async function login(correo, contrasena) {
    const { data } = await api.post('/auth/login', { correo, contrasena });
    await aplicar(data);
    return data.usuario;
  }

  async function prepararSalida() {
    const pendientes = await contarPendientes();
    return { pendientes, requiereConfirmacion: pendientes > 0 };
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setCsrf('');
    await limpiarSesionLocal();
    setUsuario(null);
  }

  const valor = useMemo(
    () => ({ usuario, cargando, login, logout, prepararSalida, recargar: cargar }),
    [usuario, cargando],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useSalir() {
  const { logout, prepararSalida } = useAuth();
  const { confirmar, dialogo } = useConfirmar();
  const navegar = useNavigate();

  async function salir() {
    const { pendientes, requiereConfirmacion } = await prepararSalida();
    if (requiereConfirmacion) {
      const ok = await confirmar(
        `Tiene ${pendientes} operación(es) pendiente(s) de sincronizar. Se conservarán en este dispositivo. Otro usuario no podrá verlas. ¿Desea salir?`,
      );
      if (!ok) return;
    }
    await logout();
    navegar('/login');
  }

  return { salir, dialogo };
}
