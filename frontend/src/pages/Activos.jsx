import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Busqueda, Cargando, Estado, Modal, Paginacion, Vacio } from '../components/ui.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha, tiene } from '../utils/formato.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function Activos() {
  const { usuario } = useAuth();
  const notificar = useNotify();
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [catalogos, setCatalogos] = useState({ tipos: [], clientes: [], ubicaciones: [] });
  const [qr, setQr] = useState(null);
  const { register, handleSubmit, watch, reset } = useForm();
  const clienteId = watch('clienteId');

  async function cargar() {
    try {
      const { data } = await api.get('/activos', { params: { q, pagina, tamano: 10 } });
      setLista(data);
    } catch (errorCarga) { setError(mensajeError(errorCarga)); }
  }
  useEffect(() => { cargar(); }, [q, pagina]);
  useEffect(() => {
    Promise.all([
      api.get('/tipos-activo', { params: { tamano: 100 } }),
      api.get('/clientes', { params: { tamano: 100 } }),
      api.get('/ubicaciones', { params: { tamano: 100, clienteId } }),
    ]).then(([tipos, clientes, ubicaciones]) => setCatalogos({
      tipos: tipos.data.datos, clientes: clientes.data.datos, ubicaciones: ubicaciones.data.datos,
    }));
  }, [clienteId]);

  return (
    <div>
      <div className="d-flex justify-content-between mb-3"><h1 className="h3">Activos</h1><button className="btn btn-primary" type="button" onClick={() => { reset({}); setModal(true); }}>Registrar activo</button></div>
      <div className="card"><div className="card-body">
        <div className="col-md-4 mb-3"><Busqueda onChange={setQ} /></div>
        <Alerta>{error}</Alerta>
        {!lista ? <Cargando /> : lista.datos.length === 0 ? <Vacio texto="No hay activos registrados." /> : (
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Código</th><th>Nombre</th><th>Cliente</th><th>Estado</th><th>Registro</th><th /></tr></thead>
            <tbody>{lista.datos.map((activo) => (
              <tr key={activo.id}>
                <td>{activo.codigo}</td><td>{activo.nombre}</td><td>{activo.cliente?.nombre}</td>
                <td><Estado codigo={activo.estado} /></td><td>{fecha(activo.fechaRegistro)}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async () => {
                    const imagen = await api.get(`/activos/${activo.id}/qr`, { responseType: 'blob' });
                    const contenido = await api.get(`/activos/${activo.id}/qr-contenido`);
                    setQr({ url: URL.createObjectURL(imagen.data), contenido: contenido.data.contenido, codigo: activo.codigo });
                  }}>QR</button>
                  {tiene(usuario, 'historial.leer') && <Link className="btn btn-sm btn-outline-primary ms-2" to={`/activos/${activo.id}`}>Historial</Link>}
                </td>
              </tr>
            ))}</tbody></table></div>
        )}
        <Paginacion meta={lista?.meta} onChange={setPagina} />
      </div></div>
      <Modal titulo="Nuevo activo" abierto={modal} onClose={() => setModal(false)}>
        <form onSubmit={handleSubmit(async (datos) => {
          try {
            await api.post('/activos', datos);
            setModal(false);
            notificar('Activo registrado y QR generado');
            cargar();
          } catch (errorGuardar) { notificar(mensajeError(errorGuardar), 'error'); }
        })}>
          <div className="modal-body d-grid gap-3">
            <div><label className="form-label">Nombre</label><input className="form-control" {...register('nombre', { required: true })} /></div>
            <div><label className="form-label">Tipo</label><select className="form-select" {...register('tipoActivoId', { required: true })}><option value="">Seleccione</option>{catalogos.tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}</select></div>
            <div className="row"><div className="col"><label className="form-label">Marca</label><input className="form-control" {...register('marca')} /></div><div className="col"><label className="form-label">Modelo</label><input className="form-control" {...register('modelo')} /></div></div>
            <div><label className="form-label">Serie</label><input className="form-control" {...register('serie')} /></div>
            <div><label className="form-label">Cliente</label><select className="form-select" {...register('clienteId', { required: true })}><option value="">Seleccione</option>{catalogos.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}</select></div>
            <div><label className="form-label">Ubicación</label><select className="form-select" {...register('ubicacionId', { required: true })}><option value="">Seleccione</option>{catalogos.ubicaciones.map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}</select></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
        </form>
      </Modal>
      <Modal titulo={`QR ${qr?.codigo || ''}`} abierto={Boolean(qr)} onClose={() => setQr(null)}>
        <div className="modal-body text-center">
          {qr && <img src={qr.url} alt={`Código QR de ${qr.codigo}`} width="240" height="240" />}
          <p className="small text-break mt-3">{qr?.contenido}</p>
        </div>
      </Modal>
    </div>
  );
}

export function HistorialActivo() {
  const id = window.location.pathname.split('/').pop();
  const [datos, setDatos] = useState(null);
  useEffect(() => { api.get(`/activos/${id}/historial`).then(({ data }) => setDatos(data.datos)); }, [id]);
  if (!datos) return <Cargando />;
  return (
    <div>
      <h1 className="h3">Historial del activo</h1>
      {datos.length === 0 ? <Vacio texto="Este activo aún no tiene historial." /> : (
        <ol className="list-group">{datos.map((evento) => (
          <li key={evento.id} className="list-group-item">
            <div className="d-flex justify-content-between"><strong><Estado codigo={evento.tipo} /> {evento.tipo}</strong><span className="small text-secondary">{fecha(evento.creadoEn)}</span></div>
            <div>{evento.descripcion}</div>
          </li>
        ))}</ol>
      )}
    </div>
  );
}
