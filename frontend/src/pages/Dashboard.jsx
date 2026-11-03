import { useEffect, useState } from 'react';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Cargando } from '../components/ui.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function Tarjeta({ titulo, valor, clase }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`card stat ${clase || ''}`}><div className="card-body">
        <div className="text-secondary small">{titulo}</div>
        <div className="fs-3 fw-semibold">{valor}</div>
      </div></div>
    </div>
  );
}

export function Dashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setDatos(data)).catch((errorCarga) => setError(mensajeError(errorCarga)));
  }, []);
  if (error) return <Alerta>{error}</Alerta>;
  if (!datos) return <Cargando />;
  return (
    <div className="d-grid gap-3">
      <h1 className="h3 mb-0">Tablero</h1>
      <div className="row g-3">
        <Tarjeta titulo="Activos" valor={datos.activos.total} />
        <Tarjeta titulo="Operativos" valor={datos.activos.operativos} clase="ok" />
        <Tarjeta titulo="Con falla" valor={datos.activos.conFalla} clase="bad" />
        <Tarjeta titulo="Incidentes abiertos" valor={datos.incidentesPendientes} clase="warn" />
        <Tarjeta titulo="Órdenes abiertas" valor={datos.ordenes.abiertas} />
        <Tarjeta titulo="En proceso" valor={datos.ordenes.enProceso} clase="warn" />
        <Tarjeta titulo="Finalizadas" valor={datos.ordenes.finalizadas} clase="ok" />
        <Tarjeta titulo="Vencidas" valor={datos.ordenes.vencidas} clase="bad" />
        <Tarjeta titulo="Cumplimiento SLA" valor={`${datos.sla.porcentaje}%`} clase="ok" />
        <Tarjeta titulo="Repuestos bajo mínimo" valor={datos.repuestosBajoMinimo} clase="warn" />
        <Tarjeta titulo="Técnicos activos" valor={datos.tecnicosActivos} />
      </div>
      <div className="row g-3">
        <div className="col-lg-5"><div className="card"><div className="card-body">
          <h2 className="h6">Activos por estado</h2>
          <Doughnut data={{
            labels: ['Operativos', 'Con falla', 'Mantenimiento', 'Fuera de servicio', 'Retirados'],
            datasets: [{ data: [datos.activos.operativos, datos.activos.conFalla, datos.activos.enMantenimiento, datos.activos.fueraDeServicio, datos.activos.retirados], backgroundColor: ['#1b7f4e', '#b42318', '#d4a017', '#5c6b7a', '#c5ced6'] }],
          }} />
        </div></div></div>
        <div className="col-lg-7"><div className="card"><div className="card-body">
          <h2 className="h6">Fallas recurrentes</h2>
          {datos.fallasRecurrentes.length === 0 ? <p className="text-secondary mb-0">Aún no hay incidentes registrados.</p> : (
            <Bar data={{
              labels: datos.fallasRecurrentes.map((item) => item.codigo),
              datasets: [{ label: 'Incidentes', data: datos.fallasRecurrentes.map((item) => item.total), backgroundColor: '#1f6feb' }],
            }} />
          )}
        </div></div></div>
      </div>
    </div>
  );
}
