import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Cargando, Estado, Paginacion, Vacio } from '../components/ui.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha } from '../utils/formato.js';

export function Movimientos() {
  const notificar = useNotify();
  const [lista, setLista] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [repuestos, setRepuestos] = useState([]);
  const [error, setError] = useState('');
  const { register, handleSubmit, reset } = useForm({ defaultValues: { tipo: 'ENTRADA', cantidad: 1 } });
  async function cargar() {
    try {
      const { data } = await api.get('/movimientos', { params: { pagina, tamano: 10 } });
      setLista(data);
    } catch (errorCarga) { setError(mensajeError(errorCarga)); }
  }
  useEffect(() => { cargar(); }, [pagina]);
  useEffect(() => { api.get('/repuestos', { params: { tamano: 100 } }).then(({ data }) => setRepuestos(data.datos)); }, []);
  return (
    <div className="d-grid gap-3">
      <h1 className="h3">Movimientos de inventario</h1>
      <form className="card" onSubmit={handleSubmit(async (datos) => {
        try {
          await api.post('/movimientos', { ...datos, cantidad: Number(datos.cantidad) });
          notificar('Movimiento registrado');
          reset({ tipo: 'ENTRADA', cantidad: 1 });
          cargar();
        } catch (errorGuardar) { notificar(mensajeError(errorGuardar), 'error'); }
      })}><div className="card-body row g-2 align-items-end">
        <div className="col-md-4"><label className="form-label">Repuesto</label><select className="form-select" {...register('repuestoId', { required: true })}><option value="">Seleccione</option>{repuestos.map((repuesto) => <option key={repuesto.id} value={repuesto.id}>{repuesto.codigo} — {repuesto.nombre}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Tipo</label><select className="form-select" {...register('tipo')}>{['ENTRADA', 'SALIDA', 'ENTREGA', 'DEVOLUCION'].map((tipo) => <option key={tipo}>{tipo}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Cantidad</label><input className="form-control" type="number" min="1" {...register('cantidad', { required: true })} /></div>
        <div className="col-md-3"><label className="form-label">Notas</label><input className="form-control" {...register('notas')} /></div>
        <div className="col-md-1"><button className="btn btn-primary">OK</button></div>
      </div></form>
      <div className="card"><div className="card-body">
        <Alerta>{error}</Alerta>
        {!lista ? <Cargando /> : lista.datos.length === 0 ? <Vacio texto="No hay movimientos." /> : (
          <table className="table"><thead><tr><th>Fecha</th><th>Repuesto</th><th>Tipo</th><th>Cantidad</th><th>Stock</th></tr></thead>
            <tbody>{lista.datos.map((movimiento) => <tr key={movimiento.id}><td>{fecha(movimiento.creadoEn)}</td><td>{movimiento.repuesto?.codigo}</td><td><Estado codigo={movimiento.tipo} /></td><td>{movimiento.cantidad}</td><td>{movimiento.stockResultante}</td></tr>)}</tbody></table>
        )}
        <Paginacion meta={lista?.meta} onChange={setPagina} />
      </div></div>
    </div>
  );
}

export function Checklists() {
  const notificar = useNotify();
  const [plantillas, setPlantillas] = useState([]);
  const { register, handleSubmit, reset } = useForm();
  async function cargar() { setPlantillas((await api.get('/checklists/plantillas')).data.datos); }
  useEffect(() => { cargar(); }, []);
  return (
    <div className="row g-3">
      <div className="col-lg-5"><form className="card" onSubmit={handleSubmit(async (datos) => {
        const items = datos.items.split('\n').map((linea) => linea.trim()).filter(Boolean).map((linea, indice) => ({
          texto: linea.replace(/^\*/, ''),
          obligatorio: linea.startsWith('*'),
          posicion: indice + 1,
        }));
        try {
          await api.post('/checklists/plantillas', { nombre: datos.nombre, descripcion: datos.descripcion, items });
          reset();
          notificar('Plantilla creada');
          cargar();
        } catch (error) { notificar(mensajeError(error), 'error'); }
      })}><div className="card-body d-grid gap-2">
        <h1 className="h5">Nueva plantilla</h1>
        <input className="form-control" placeholder="Nombre" {...register('nombre', { required: true })} />
        <textarea className="form-control" rows={5} placeholder={'Una actividad por línea. Inicie con * si es obligatoria.'} {...register('items', { required: true })} />
        <button className="btn btn-primary">Crear</button>
      </div></form></div>
      <div className="col-lg-7">{plantillas.map((plantilla) => (
        <div key={plantilla.id} className="card mb-2"><div className="card-body">
          <h2 className="h6">{plantilla.nombre}</h2>
          <ul className="mb-0">{plantilla.items.map((item) => <li key={item.id}>{item.texto} {item.obligatorio ? '(obligatoria)' : ''}</li>)}</ul>
        </div></div>
      ))}</div>
    </div>
  );
}

export function Mantenimientos() {
  const notificar = useNotify();
  const [lista, setLista] = useState(null);
  const [activos, setActivos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const { register, handleSubmit, reset } = useForm();
  async function cargar() { setLista((await api.get('/mantenimientos', { params: { tamano: 20 } })).data); }
  useEffect(() => {
    cargar();
    api.get('/activos', { params: { tamano: 100 } }).then(({ data }) => setActivos(data.datos));
    api.get('/tecnicos', { params: { tamano: 100 } }).then(({ data }) => setTecnicos(data.datos));
  }, []);
  return (
    <div className="d-grid gap-3">
      <h1 className="h3">Mantenimientos preventivos</h1>
      <form className="card" onSubmit={handleSubmit(async (datos) => {
        try {
          await api.post('/mantenimientos', { ...datos, fechaProgramada: new Date(datos.fechaProgramada).toISOString() });
          reset();
          notificar('Mantenimiento programado');
          cargar();
        } catch (error) { notificar(mensajeError(error), 'error'); }
      })}><div className="card-body row g-2">
        <div className="col-md-4"><label className="form-label">Activo</label><select className="form-select" {...register('activoId', { required: true })}><option value="">Seleccione</option>{activos.map((activo) => <option key={activo.id} value={activo.id}>{activo.codigo}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Responsable</label><select className="form-select" {...register('responsableId', { required: true })}><option value="">Seleccione</option>{tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.usuario.nombre} {tecnico.usuario.apellido}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Frecuencia</label><select className="form-select" {...register('frecuencia')}>{['DIARIA', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Fecha</label><input className="form-control" type="datetime-local" {...register('fechaProgramada', { required: true })} /></div>
        <div className="col-12"><textarea className="form-control" placeholder="Descripción" {...register('descripcion', { required: true })} /></div>
        <div className="col-12"><button className="btn btn-primary">Programar</button></div>
      </div></form>
      {!lista ? <Cargando /> : lista.datos.map((item) => (
        <div key={item.id} className="card"><div className="card-body d-flex justify-content-between align-items-center">
          <div><strong>{item.activo?.codigo}</strong> — {item.descripcion}<div className="small text-secondary">{item.frecuencia} · {fecha(item.fechaProgramada)} · <Estado codigo={item.estado} /></div></div>
          {item.estado === 'PROGRAMADO' && <button type="button" className="btn btn-outline-primary" onClick={async () => {
            try {
              const { data } = await api.post(`/mantenimientos/${item.id}/generar-orden`);
              notificar(`Orden ${data.codigo} generada`);
              cargar();
            } catch (error) { notificar(mensajeError(error), 'error'); }
          }}>Generar orden</button>}
        </div></div>
      ))}
    </div>
  );
}

export function Aprobaciones() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/aprobaciones', { params: { tamano: 20 } })
      .then(({ data }) => setLista(data))
      .catch((errorCarga) => setError(mensajeError(errorCarga)));
  }, []);
  return (
    <div>
      <h1 className="h3">Cierres pendientes</h1>
      <Alerta>{error}</Alerta>
      {!lista ? <Cargando /> : lista.datos.length === 0 ? <Vacio texto="No hay cierres pendientes de revisión." /> : (
        <div className="d-grid gap-2">{lista.datos.map((orden) => (
          <div key={orden.id} className="card"><div className="card-body d-flex justify-content-between align-items-center">
            <div><strong>{orden.codigo}</strong> — {orden.titulo}<div className="small text-secondary">{fecha(orden.slaResolucionVenceEn)}</div></div>
            <Link className="btn btn-sm btn-primary" to={`/ordenes/${orden.id}`}>Revisar</Link>
          </div></div>
        ))}</div>
      )}
    </div>
  );
}
