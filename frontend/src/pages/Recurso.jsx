import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Busqueda, Cargando, Estado, Modal, Paginacion, Vacio, useConfirmar } from '../components/ui.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { tiene } from '../utils/formato.js';

function Campo({ campo, register, opciones }) {
  const comun = { className: 'form-control', ...register(campo.nombre, { required: campo.requerido, valueAsNumber: campo.tipo === 'number' }) };
  if (campo.tipo === 'select') {
    return (
      <select className="form-select" {...register(campo.nombre, { required: campo.requerido })}>
        <option value="">Seleccione</option>
        {(opciones[campo.nombre] || campo.opciones || []).map((opcion) => (
          <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
        ))}
      </select>
    );
  }
  if (campo.tipo === 'checks') {
    return (opciones[campo.nombre] || []).map((opcion) => (
      <label key={opcion.value} className="form-check">
        <input className="form-check-input" type="checkbox" value={opcion.value} {...register(campo.nombre)} /> {opcion.label}
      </label>
    ));
  }
  if (campo.tipo === 'textarea') return <textarea rows={3} {...comun} />;
  if (campo.tipo === 'check') return <input type="checkbox" className="form-check-input" {...register(campo.nombre)} />;
  return <input type={campo.tipo || 'text'} {...comun} />;
}

export function Recurso({ titulo, endpoint, columnas, camposCrear = [], camposEditar = [], permisoCrear, permisoEditar, filtrosExtra = {}, prepararEdicion }) {
  const { usuario } = useAuth();
  const notificar = useNotify();
  const { dialogo } = useConfirmar();
  const [q, setQ] = useState('');
  const cambiarQ = useCallback((valor) => setQ(valor), []);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState({ cargando: true, error: '', datos: [], meta: null });
  const [modal, setModal] = useState(null);
  const [opciones, setOpciones] = useState({});
  const { register, handleSubmit, reset } = useForm();

  const cargar = useCallback(async () => {
    setEstado((previo) => ({ ...previo, cargando: true, error: '' }));
    try {
      const { data } = await api.get(endpoint, { params: { pagina, tamano: 10, q, ...filtrosExtra } });
      setEstado({ cargando: false, error: '', datos: data.datos || [], meta: data.meta });
    } catch (error) {
      setEstado({ cargando: false, error: mensajeError(error), datos: [], meta: null });
    }
  }, [endpoint, pagina, q, JSON.stringify(filtrosExtra)]);

  useEffect(() => { cargar(); }, [cargar]);

  async function abrir(modo, fila) {
    const campos = modo === 'crear' ? camposCrear : camposEditar;
    const cargadas = {};
    for (const campo of campos) {
      if (campo.origen) {
        const { data } = await api.get(campo.origen, { params: { tamano: 100 } });
        cargadas[campo.nombre] = (data.datos || []).map((item) => ({
          value: item.id,
          label: campo.etiquetaOpcion ? campo.etiquetaOpcion(item) : item.nombre,
        }));
      }
    }
    setOpciones(cargadas);
    reset(fila && prepararEdicion ? prepararEdicion(fila) : (fila || {}));
    setModal({ modo, id: fila?.id });
  }

  async function guardar(datos) {
    try {
      if (typeof datos.miembros === 'string') datos.miembros = [datos.miembros];
      for (const [clave, valor] of Object.entries(datos)) {
        if (typeof valor === 'number' && Number.isNaN(valor)) delete datos[clave];
      }
      if (modal.modo === 'crear') await api.post(endpoint, datos);
      else await api.patch(`${endpoint}/${modal.id}`, datos);
      setModal(null);
      notificar('Registro guardado');
      cargar();
    } catch (error) {
      notificar(mensajeError(error), 'error');
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h1 className="h3 mb-0">{titulo}</h1>
        {tiene(usuario, permisoCrear) && <button className="btn btn-primary" type="button" onClick={() => abrir('crear')}><i className="bi bi-plus-lg" /> Nuevo</button>}
      </div>
      <div className="card"><div className="card-body">
        <div className="col-md-4 mb-3"><Busqueda valor={q} onChange={cambiarQ} /></div>
        <Alerta>{estado.error}</Alerta>
        {estado.cargando ? <Cargando /> : estado.datos.length === 0 ? <Vacio texto="No hay registros." /> : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead><tr>{columnas.map((columna) => <th key={columna.titulo}>{columna.titulo}</th>)}<th /></tr></thead>
              <tbody>
                {estado.datos.map((fila) => (
                  <tr key={fila.id}>
                    {columnas.map((columna) => <td key={columna.titulo}>{columna.render ? columna.render(fila) : fila[columna.campo]}</td>)}
                    <td className="text-end">
                      {tiene(usuario, permisoEditar) && camposEditar.length > 0 && (
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => abrir('editar', fila)}>Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion meta={estado.meta} onChange={setPagina} />
      </div></div>
      <Modal titulo={modal?.modo === 'editar' ? 'Editar' : 'Nuevo'} abierto={Boolean(modal)} onClose={() => setModal(null)}>
        <form onSubmit={handleSubmit(guardar)}>
          <div className="modal-body d-grid gap-3">
            {(modal?.modo === 'editar' ? camposEditar : camposCrear).map((campo) => (
              <div key={campo.nombre}>
                {campo.tipo === 'check' ? (
                  <label className="form-check"><Campo campo={campo} register={register} opciones={opciones} /> {campo.etiqueta}</label>
                ) : (
                  <><label className="form-label">{campo.etiqueta}</label><Campo campo={campo} register={register} opciones={opciones} /></>
                )}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>
      {dialogo}
    </div>
  );
}

export { Estado };
