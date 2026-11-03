import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Busqueda, Cargando, Estado, Paginacion, Vacio } from '../components/ui.jsx';
import { fecha } from '../utils/formato.js';

export function Ordenes({ base = '/ordenes', tecnico = false }) {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState([]);

  useEffect(() => {
    const ruta = tecnico ? '/tecnico/ordenes' : '/ordenes';
    api.get(ruta, { params: { q, pagina, tamano: 10, estado } }).then(async ({ data }) => {
      setLista(data);
      if (tecnico) {
        const { guardarOrdenes } = await import('../pwa/db.js');
        await guardarOrdenes(data.datos);
      }
    }).catch(async (errorCarga) => {
      if (tecnico && !navigator.onLine) {
        const { leerOrdenes } = await import('../pwa/db.js');
        setOffline(await leerOrdenes());
      } else setError(mensajeError(errorCarga));
    });
  }, [q, pagina, estado, tecnico]);

  const datos = lista?.datos || offline;
  return (
    <div>
      <h1 className="h3">{tecnico ? 'Mis órdenes' : 'Órdenes de trabajo'}</h1>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-6"><Busqueda onChange={setQ} /></div>
          <div className="col-md-3">
            <select className="form-select" value={estado} onChange={(evento) => setEstado(evento.target.value)}>
              <option value="">Todos los estados</option>
              {['PENDIENTE', 'ASIGNADA', 'ACEPTADA', 'EN_PROCESO', 'PENDIENTE_APROBACION', 'FINALIZADA', 'RECHAZADA', 'CANCELADA'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <Alerta>{error}</Alerta>
        {!lista && offline.length === 0 ? <Cargando /> : datos.length === 0 ? <Vacio texto="No hay órdenes." /> : (
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Código</th><th>Título</th><th>Prioridad</th><th>Estado</th><th>SLA</th><th /></tr></thead>
            <tbody>{datos.map((orden) => (
              <tr key={orden.id}>
                <td>{orden.codigo}</td><td>{orden.titulo}</td>
                <td><Estado codigo={orden.prioridad} /></td><td><Estado codigo={orden.estado} /></td>
                <td>{orden.slaResolucionIncumplido ? <span className="text-danger">Vencida</span> : fecha(orden.slaResolucionVenceEn)}</td>
                <td><Link className="btn btn-sm btn-outline-primary" to={`${base}/${orden.id}`}>Abrir</Link></td>
              </tr>
            ))}</tbody></table></div>
        )}
        <Paginacion meta={lista?.meta} onChange={setPagina} />
      </div></div>
    </div>
  );
}
