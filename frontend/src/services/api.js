import axios from 'axios';
import { getCsrf, setCsrf } from './csrf.js';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

const plano = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const csrf = getCsrf();
  if (csrf) config.headers['X-CSRF-Token'] = csrf;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

let renovacion = null;

api.interceptors.response.use((respuesta) => respuesta, async (error) => {
  const original = error.config;
  const url = original?.url || '';
  if (error.response?.status !== 401 || original?._reintento || url.includes('/auth/')) {
    return Promise.reject(error);
  }
  original._reintento = true;
  try {
    renovacion ||= plano.post('/auth/refresh').finally(() => { renovacion = null; });
    const renovada = await renovacion;
    setCsrf(renovada.data.csrfToken);
    original.headers['X-CSRF-Token'] = getCsrf();
    return api(original);
  } catch {
    window.dispatchEvent(new Event('sigot:sesion-expirada'));
    return Promise.reject(error);
  }
});

export function mensajeError(error) {
  return error?.response?.data?.error?.mensaje || 'No se pudo completar la operación';
}
