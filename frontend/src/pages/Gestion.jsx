import { useEffect, useState } from 'react';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Cargando, Estado, Paginacion } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha } from '../utils/formato.js';
import { Recurso } from './Recurso.jsx';

export function Sla() {
  const notificar = useNotify();
  const [politicas, setPoliticas] = useState([]);
  useEffect(() => { api.get('/sla').then(({ data }) => setPoliticas(data.datos)); }, []);
  return (
    <div>
      <h1 className="h3">Prioridades y SLA</h1>
      <div className="d-grid gap-3">
        {politicas.map((politica) => (
          <form key={politica.id} className="card" onSubmit={async (evento) => {
            evento.preventDefault();
            const datos = Object.fromEntries(new FormData(evento.currentTarget));
            try {
              await api.put(`/sla/${politica.prioridad}`, {
                minutosRespuesta: Number(datos.minutosRespuesta),
                minutosResolucion: Number(datos.minutosResolucion),
                activa: datos.activa === 'on',
              });
              notificar('SLA actualizado');
            } catch (error) { notificar(mensajeError(error), 'error'); }
          }}><div className="card-body row g-2 align-items-end">
            <div className="col-md-2"><Estado codigo={politica.prioridad} /></div>
            <div className="col-md-3"><label className="form-label">Respuesta (min)</label><input className="form-control" name="minutosRespuesta" type="number" defaultValue={politica.minutosRespuesta} /></div>
            <div className="col-md-3"><label className="form-label">Resolución (min)</label><input className="form-control" name="minutosResolucion" type="number" defaultValue={politica.minutosResolucion} /></div>
            <div className="col-md-2 form-check mt-4"><label className="form-check-label"><input className="form-check-input" type="checkbox" name="activa" defaultChecked={politica.activa} /> Activa</label></div>
            <div className="col-md-2"><button className="btn btn-primary w-100">Guardar</button></div>
          </div></form>
        ))}
      </div>
    </div>
  );
}

export function Reportes() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  async function consultar(evento) {
    evento.preventDefault();
    const params = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      const { data } = await api.get('/reportes/operativo', { params });
      setDatos(data.datos);
    } catch (errorCarga) { setError(mensajeError(errorCarga)); }
  }
  return (
    <div>
      <h1 className="h3">Reportes</h1>
      <form className="card mb-3" onSubmit={consultar}><div className="card-body row g-2">
        <div className="col-md-3"><label className="form-label">Desde</label><input className="form-control" type="date" name="desde" /></div>
        <div className="col-md-3"><label className="form-label">Hasta</label><input className="form-control" type="date" name="hasta" /></div>
        <div className="col-md-3"><label className="form-label">Prioridad</label><select className="form-select" name="prioridad"><option value="">Todas</option><option>BAJA</option><option>MEDIA</option><option>ALTA</option><option>CRITICA</option></select></div>
        <div className="col-md-3 d-flex align-items-end gap-2"><button className="btn btn-primary">Consultar</button>
          <a className="btn btn-outline-secondary" href="/api/reportes/exportar">Exportar CSV</a></div>
      </div></form>
      <Alerta>{error}</Alerta>
      {datos && <div className="card"><div className="card-body table-responsive"><table className="table"><thead><tr><th>Código</th><th>Título</th><th>Estado</th><th>Prioridad</th><th>Creada</th></tr></thead><tbody>
        {datos.map((orden) => <tr key={orden.id}><td>{orden.codigo}</td><td>{orden.titulo}</td><td><Estado codigo={orden.estado} /></td><td><Estado codigo={orden.prioridad} /></td><td>{fecha(orden.creadoEn)}</td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}

export function Auditoria() {
  const [lista, setLista] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [verificacion, setVerificacion] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/auditoria', { params: { pagina, tamano: 15 } }).then(({ data }) => setLista(data)).catch((errorCarga) => setError(mensajeError(errorCarga)));
  }, [pagina]);
  return (
    <div>
      <div className="d-flex justify-content-between mb-3">
        <h1 className="h3">Auditoría</h1>
        <button type="button" className="btn btn-outline-primary" onClick={async () => setVerificacion((await api.get('/auditoria/verificar')).data)}>Verificar integridad</button>
      </div>
      {verificacion && <div className={`alert ${verificacion.integra ? 'alert-success' : 'alert-danger'}`}>{verificacion.integra ? `Cadena íntegra (${verificacion.total} registros).` : `Integridad rota en la secuencia ${verificacion.secuencia}.`}</div>}
      <Alerta>{error}</Alerta>
      {!lista ? <Cargando /> : (
        <div className="card"><div className="card-body table-responsive">
          <table className="table"><thead><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Resultado</th></tr></thead>
            <tbody>{lista.datos.map((fila) => <tr key={fila.id}><td>{fila.secuencia}</td><td>{fecha(fila.creadoEn)}</td><td>{fila.usuario ? `${fila.usuario.nombre} ${fila.usuario.apellido}` : '—'}</td><td>{fila.accion}</td><td>{fila.entidad}</td><td><Estado codigo={fila.resultado === 'EXITO' ? 'ACTIVO' : 'CON_FALLA'} /></td></tr>)}</tbody>
          </table>
          <Paginacion meta={lista.meta} onChange={setPagina} />
        </div></div>
      )}
    </div>
  );
}

export function Configuracion() {
  const notificar = useNotify();
  const [valores, setValores] = useState(null);
  useEffect(() => {
    api.get('/configuracion').then(({ data }) => {
      const mapa = Object.fromEntries(data.datos.map((item) => [item.clave, item.valor]));
      setValores(mapa);
    });
  }, []);
  if (!valores) return <Cargando />;
  return (
    <form className="card" onSubmit={async (evento) => {
      evento.preventDefault();
      const datos = Object.fromEntries(new FormData(evento.currentTarget));
      try {
        await api.put('/configuracion', {
          nombre_sistema: datos.nombre_sistema,
          evidencia_minima: Number(datos.evidencia_minima),
          checklist_obligatorio: datos.checklist_obligatorio === 'on',
        });
        notificar('Configuración guardada');
      } catch (error) { notificar(mensajeError(error), 'error'); }
    }}><div className="card-body d-grid gap-3" style={{ maxWidth: 520 }}>
      <h1 className="h3">Configuración</h1>
      <div><label className="form-label">Nombre del sistema</label><input className="form-control" name="nombre_sistema" defaultValue={valores.nombre_sistema} /></div>
      <div><label className="form-label">Evidencias mínimas para cierre</label><input className="form-control" type="number" min="1" name="evidencia_minima" defaultValue={valores.evidencia_minima} /></div>
      <label className="form-check"><input className="form-check-input" type="checkbox" name="checklist_obligatorio" defaultChecked={valores.checklist_obligatorio !== false} /> Checklist obligatorio</label>
      <button className="btn btn-primary">Guardar</button>
    </div></form>
  );
}

export function InicioTecnico() {
  const [resumen, setResumen] = useState(null);
  useEffect(() => {
    api.get('/tecnico/ordenes', { params: { tamano: 100 } }).then(({ data }) => {
      const conteo = data.datos.reduce((acumulado, orden) => ({ ...acumulado, [orden.estado]: (acumulado[orden.estado] || 0) + 1 }), {});
      setResumen({ total: data.meta.total, conteo });
    }).catch(() => setResumen({ total: 0, conteo: {} }));
  }, []);
  if (!resumen) return <Cargando />;
  return (
    <div>
      <h1 className="h4">Trabajo de campo</h1>
      <div className="row g-2">
        <div className="col-6"><div className="card"><div className="card-body"><div className="small text-secondary">Asignadas</div><div className="fs-3">{resumen.total}</div></div></div></div>
        <div className="col-6"><div className="card"><div className="card-body"><div className="small text-secondary">En proceso</div><div className="fs-3">{resumen.conteo.EN_PROCESO || 0}</div></div></div></div>
      </div>
    </div>
  );
}

export function Sincronizacion() {
  const notificar = useNotify();
  const { usuario } = useAuth();
  const [cola, setCola] = useState([]);
  async function refrescar() {
    const { leerCola } = await import('../pwa/db.js');
    setCola(await leerCola());
  }
  useEffect(() => { refrescar(); }, []);
  return (
    <div>
      <div className="d-flex justify-content-between mb-3">
        <h1 className="h4">Sincronización</h1>
        <button type="button" className="btn btn-primary" onClick={async () => {
          const { sincronizarCola } = await import('../pwa/sync.js');
          try {
            await sincronizarCola({ usuarioId: usuario?.id, notificar, forzar: true });
            refrescar();
          } catch (error) { notificar(mensajeError(error), 'error'); }
        }}>Sincronizar ahora</button>
      </div>
      {cola.length === 0 ? <p className="text-secondary">No hay operaciones pendientes.</p> : (
        <ul className="list-group">{cola.map((item) => (
          <li key={item.id} className="list-group-item">
            <strong>{item.tipo}</strong>
            <div className="small text-secondary">{fecha(item.creadoEn)} · {item.estado || 'pendiente'}</div>
            {item.error && <div className="text-danger small">{item.error}</div>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}

export function HistorialTecnico() {
  const [ordenes, setOrdenes] = useState(null);
  useEffect(() => {
    api.get('/tecnico/ordenes', { params: { tamano: 50, estado: 'FINALIZADA' } }).then(({ data }) => setOrdenes(data.datos));
  }, []);
  if (!ordenes) return <Cargando />;
  return (
    <div>
      <h1 className="h4">Historial</h1>
      {ordenes.length === 0 ? <p className="text-secondary">Aún no hay trabajos finalizados.</p> : ordenes.map((orden) => (
        <div key={orden.id} className="card mb-2"><div className="card-body d-flex justify-content-between"><span>{orden.codigo} — {orden.titulo}</span><Estado codigo={orden.estado} /></div></div>
      ))}
    </div>
  );
}

export function Clientes() {
  return <Recurso titulo="Clientes" endpoint="/clientes" permisoCrear="clientes.escribir" permisoEditar="clientes.escribir"
    columnas={[{ titulo: 'Código', campo: 'codigo' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'NIT', campo: 'nit' }, { titulo: 'Estado', render: (fila) => fila.activo ? 'Activo' : 'Inactivo' }]}
    camposCrear={campoCliente(false)} camposEditar={campoCliente(true)} />;
}
function campoCliente(edicion) {
  return [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'nit', etiqueta: 'NIT' },
    { nombre: 'correo', etiqueta: 'Correo', tipo: 'email' },
    { nombre: 'telefono', etiqueta: 'Teléfono' },
    { nombre: 'direccion', etiqueta: 'Dirección' },
    ...(edicion ? [{ nombre: 'activo', etiqueta: 'Activo', tipo: 'check' }] : []),
  ];
}

export function Ubicaciones() {
  return <Recurso titulo="Ubicaciones" endpoint="/ubicaciones" permisoCrear="ubicaciones.escribir" permisoEditar="ubicaciones.escribir"
    columnas={[{ titulo: 'Código', campo: 'codigo' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Cliente', render: (fila) => fila.cliente?.nombre }, { titulo: 'Ciudad', campo: 'ciudad' }]}
    camposCrear={[
      { nombre: 'clienteId', etiqueta: 'Cliente', tipo: 'select', requerido: true, origen: '/clientes', etiquetaOpcion: (item) => item.nombre },
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'direccion', etiqueta: 'Dirección', requerido: true },
      { nombre: 'ciudad', etiqueta: 'Ciudad' },
    ]}
    camposEditar={[
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'direccion', etiqueta: 'Dirección', requerido: true },
      { nombre: 'ciudad', etiqueta: 'Ciudad' },
      { nombre: 'activo', etiqueta: 'Activa', tipo: 'check' },
    ]} />;
}

export function TiposActivo() {
  return <Recurso titulo="Tipos de activo" endpoint="/tipos-activo" permisoCrear="tipos_activo.escribir" permisoEditar="tipos_activo.escribir"
    columnas={[{ titulo: 'Código', campo: 'codigo' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Descripción', campo: 'descripcion' }]}
    camposCrear={[{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }, { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' }]}
    camposEditar={[{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }, { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' }, { nombre: 'activo', etiqueta: 'Activo', tipo: 'check' }]} />;
}

export function Tecnicos() {
  return <Recurso titulo="Técnicos" endpoint="/tecnicos" permisoCrear="tecnicos.escribir" permisoEditar="tecnicos.escribir"
    columnas={[{ titulo: 'Código', campo: 'codigoEmpleado' }, { titulo: 'Nombre', render: (fila) => `${fila.usuario.nombre} ${fila.usuario.apellido}` }, { titulo: 'Especialidad', campo: 'especialidad' }, { titulo: 'Estado', render: (fila) => fila.activo ? 'Activo' : 'Inactivo' }]}
    camposCrear={[
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'apellido', etiqueta: 'Apellido', requerido: true },
      { nombre: 'correo', etiqueta: 'Correo', tipo: 'email', requerido: true },
      { nombre: 'contrasena', etiqueta: 'Contraseña temporal', tipo: 'password', requerido: true },
      { nombre: 'telefono', etiqueta: 'Teléfono' },
      { nombre: 'especialidad', etiqueta: 'Especialidad' },
    ]}
    camposEditar={[
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'apellido', etiqueta: 'Apellido', requerido: true },
      { nombre: 'telefono', etiqueta: 'Teléfono' },
      { nombre: 'especialidad', etiqueta: 'Especialidad' },
      { nombre: 'activo', etiqueta: 'Activo', tipo: 'check' },
    ]} />;
}

export function Cuadrillas() {
  return <Recurso titulo="Cuadrillas" endpoint="/cuadrillas" permisoCrear="cuadrillas.escribir" permisoEditar="cuadrillas.escribir"
    columnas={[{ titulo: 'Código', campo: 'codigo' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Responsable', render: (fila) => fila.responsable ? `${fila.responsable.usuario.nombre} ${fila.responsable.usuario.apellido}` : '—' }]}
    prepararEdicion={(fila) => ({
      nombre: fila.nombre,
      responsableId: fila.responsableId,
      activa: fila.activa,
      miembros: (fila.miembros || []).map((miembro) => miembro.tecnicoId),
    })}
    camposCrear={[
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'responsableId', etiqueta: 'Responsable', tipo: 'select', requerido: true, origen: '/tecnicos', etiquetaOpcion: (item) => `${item.codigoEmpleado} ${item.usuario.nombre}` },
      { nombre: 'miembros', etiqueta: 'Miembros', tipo: 'checks', origen: '/tecnicos', etiquetaOpcion: (item) => `${item.codigoEmpleado} ${item.usuario.nombre}` },
    ]}
    camposEditar={[
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
      { nombre: 'responsableId', etiqueta: 'Responsable', tipo: 'select', requerido: true, origen: '/tecnicos', etiquetaOpcion: (item) => `${item.codigoEmpleado} ${item.usuario.nombre}` },
      { nombre: 'miembros', etiqueta: 'Miembros', tipo: 'checks', origen: '/tecnicos', etiquetaOpcion: (item) => `${item.codigoEmpleado} ${item.usuario.nombre}` },
      { nombre: 'activa', etiqueta: 'Activa', tipo: 'check' },
    ]} />;
}

export function Repuestos() {
  const [alertas, setAlertas] = useState([]);
  useEffect(() => { api.get('/repuestos/alertas').then(({ data }) => setAlertas(data.datos)).catch(() => {}); }, []);
  return (
    <div className="d-grid gap-3">
      {alertas.length > 0 && <div className="alert alert-warning">{alertas.length} repuesto(s) en o bajo el mínimo: {alertas.map((item) => item.codigo).join(', ')}</div>}
      <Recurso titulo="Repuestos" endpoint="/repuestos" permisoCrear="repuestos.escribir" permisoEditar="repuestos.escribir"
        columnas={[{ titulo: 'Código', campo: 'codigo' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Stock', campo: 'stock' }, { titulo: 'Mínimo', campo: 'stockMinimo' }, { titulo: 'Estado', render: (fila) => <Estado codigo={fila.estado} /> }]}
        camposCrear={[
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
          { nombre: 'categoriaId', etiqueta: 'Categoría', tipo: 'select', requerido: true, origen: '/repuestos/categorias' },
          { nombre: 'stock', etiqueta: 'Stock inicial', tipo: 'number' },
          { nombre: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'number' },
          { nombre: 'ubicacionAlmacen', etiqueta: 'Ubicación en bodega' },
        ]}
        camposEditar={[
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
          { nombre: 'categoriaId', etiqueta: 'Categoría', tipo: 'select', requerido: true, origen: '/repuestos/categorias' },
          { nombre: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'number', requerido: true },
          { nombre: 'ubicacionAlmacen', etiqueta: 'Ubicación en bodega' },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }] },
        ]} />
    </div>
  );
}
