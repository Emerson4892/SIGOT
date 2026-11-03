import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Busqueda, Cargando, Estado, Modal, Paginacion, Vacio } from '../components/ui.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha } from '../utils/formato.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { tiene } from '../utils/formato.js';

export function Incidentes() {
  const notificar = useNotify();
  const navegar = useNavigate();
  const { usuario } = useAuth();
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [activos, setActivos] = useState([]);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { prioridad: 'MEDIA' } });

  async function cargar() {
    try {
      const { data } = await api.get('/incidentes', { params: { q, pagina, tamano: 10 } });
      setLista(data);
    } catch (errorCarga) { setError(mensajeError(errorCarga)); }
  }
  useEffect(() => { cargar(); }, [q, pagina]);

  return (
    <div>
      <div className="d-flex justify-content-between mb-3">
        <h1 className="h3">Incidentes</h1>
        {tiene(usuario, 'incidentes.escribir') && <button className="btn btn-primary" type="button" onClick={async () => {
          const { data } = await api.get('/activos', { params: { tamano: 100 } });
          setActivos(data.datos);
          reset({ prioridad: 'MEDIA' });
          setModal(true);
        }}>Registrar incidente</button>}
      </div>
      <div className="card"><div className="card-body">
        <div className="col-md-4 mb-3"><Busqueda onChange={setQ} /></div>
        <Alerta>{error}</Alerta>
        {!lista ? <Cargando /> : lista.datos.length === 0 ? <Vacio texto="No hay incidentes." /> : (
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Código</th><th>Activo</th><th>Prioridad</th><th>Estado</th><th>Reporte</th><th /></tr></thead>
            <tbody>{lista.datos.map((incidente) => (
              <tr key={incidente.id}>
                <td>{incidente.codigo}</td><td>{incidente.activo?.codigo}</td>
                <td><Estado codigo={incidente.prioridad} /></td><td><Estado codigo={incidente.estado} /></td>
                <td>{fecha(incidente.fechaReporte)}</td>
                <td className="text-end">{incidente.estado === 'ABIERTO' && tiene(usuario, 'ordenes.escribir') && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={async () => {
                    try {
                      const { data } = await api.post(`/incidentes/${incidente.id}/convertir`);
                      notificar('Orden creada');
                      navegar(`/ordenes/${data.id}`);
                    } catch (errorConversion) { notificar(mensajeError(errorConversion), 'error'); }
                  }}>Crear orden</button>
                )}{incidente.orden && <span className="small ms-2">{incidente.orden.codigo}</span>}</td>
              </tr>
            ))}</tbody></table></div>
        )}
        <Paginacion meta={lista?.meta} onChange={setPagina} />
      </div></div>
      <Modal titulo="Nuevo incidente" abierto={modal} onClose={() => setModal(false)}>
        <form onSubmit={handleSubmit(async (datos) => {
          try {
            await api.post('/incidentes', datos);
            setModal(false);
            notificar('Incidente registrado');
            cargar();
          } catch (errorGuardar) { notificar(mensajeError(errorGuardar), 'error'); }
        })}>
          <div className="modal-body d-grid gap-3">
            <div><label className="form-label">Activo</label><select className="form-select" {...register('activoId', { required: true })}><option value="">Seleccione</option>{activos.map((activo) => <option key={activo.id} value={activo.id}>{activo.codigo} — {activo.nombre}</option>)}</select></div>
            <div><label className="form-label">Prioridad</label><select className="form-select" {...register('prioridad')}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option><option value="CRITICA">Crítica</option></select></div>
            <div><label className="form-label">Descripción</label><textarea className="form-control" rows={4} {...register('descripcion', { required: true })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
        </form>
      </Modal>
    </div>
  );
}
