import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Cargando, Estado } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha, tiene } from '../utils/formato.js';
import { crearOperacion } from '../pwa/syncQueue.js';
import { encolar } from '../pwa/db.js';

async function enviarOEncolar(enLinea, operacion, peticion) {
  if (!enLinea && ['DIAGNOSTICO', 'SOLUCION', 'CHECKLIST', 'REPUESTOS', 'SOLICITAR_CIERRE', 'EVIDENCIA'].includes(operacion.tipo)) {
    await encolar(operacion);
    return { encolado: true };
  }
  await peticion();
  return { encolado: false };
}

export function DetalleOrden() {
  const { id } = useParams();
  const contexto = useOutletContext() || {};
  const { usuario } = useAuth();
  const notificar = useNotify();
  const [orden, setOrden] = useState(null);
  const [error, setError] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [cuadrillas, setCuadrillas] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [qr, setQr] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [solucion, setSolucion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [token, setToken] = useState('');
  const [repuestoId, setRepuestoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const enLinea = contexto.enLinea ?? navigator.onLine;

  async function cargar() {
    try {
      const { data } = await api.get(`/ordenes/${id}`);
      setOrden(data);
      setDiagnostico(data.diagnostico || '');
      setSolucion(data.solucion || '');
    } catch (errorCarga) {
      setError(mensajeError(errorCarga));
    }
  }

  useEffect(() => { cargar(); }, [id]);
  useEffect(() => {
    if (tiene(usuario, 'ordenes.asignar')) {
      api.get('/tecnicos', { params: { tamano: 100 } }).then(({ data }) => setTecnicos(data.datos));
      api.get('/cuadrillas', { params: { tamano: 100 } }).then(({ data }) => setCuadrillas(data.datos));
    }
    if (tiene(usuario, 'checklists.leer')) api.get('/checklists/plantillas').then(({ data }) => setPlantillas(data.datos));
    if (tiene(usuario, 'repuestos.leer')) api.get('/repuestos', { params: { tamano: 100 } }).then(({ data }) => setRepuestos(data.datos));
  }, [usuario]);

  async function accion(promesa, mensaje) {
    try {
      await promesa;
      notificar(mensaje);
      await cargar();
    } catch (errorAccion) {
      notificar(mensajeError(errorAccion), 'error');
    }
  }

  async function escanear() {
    const region = document.getElementById('lector-qr');
    const { Html5Qrcode } = await import('html5-qrcode');
    const lector = new Html5Qrcode('lector-qr');
    await lector.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, async (texto) => {
      setQr(texto);
      await lector.stop();
      region.innerHTML = '';
    });
  }

  if (error) return <Alerta>{error}</Alerta>;
  if (!orden) return <Cargando />;
  const plantilla = plantillas[0];

  return (
    <div className="d-grid gap-3">
      <div className="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-1">{orden.codigo}</h1>
          <div>{orden.titulo}</div>
        </div>
        <div className="d-flex gap-2 align-items-start">
          <Estado codigo={orden.prioridad} />
          <Estado codigo={orden.estado} />
        </div>
      </div>
      <div className="card"><div className="card-body">
        <p>{orden.descripcion}</p>
        <div className="row small text-secondary">
          <div className="col-md-4">Activo: {orden.activo?.codigo} — {orden.activo?.nombre}</div>
          <div className="col-md-4">Cliente: {orden.activo?.cliente?.nombre}</div>
          <div className="col-md-4">SLA: {fecha(orden.slaResolucionVenceEn)} {orden.slaResolucionIncumplido && <span className="text-danger">Vencida</span>}</div>
        </div>
      </div></div>

      {tiene(usuario, 'ordenes.asignar') && ['PENDIENTE', 'ASIGNADA', 'ACEPTADA', 'RECHAZADA'].includes(orden.estado) && (
        <form className="card" onSubmit={(evento) => {
          evento.preventDefault();
          const datos = Object.fromEntries(new FormData(evento.currentTarget));
          accion(api.post(`/ordenes/${id}/asignar`, { tecnicoId: datos.tecnicoId || null, cuadrillaId: datos.cuadrillaId || null }), 'Asignación registrada');
        }}><div className="card-body d-grid gap-2">
          <h2 className="h6">Asignar</h2>
          <select className="form-select" name="tecnicoId"><option value="">Técnico</option>{tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.codigoEmpleado} — {tecnico.usuario.nombre} {tecnico.usuario.apellido}</option>)}</select>
          <select className="form-select" name="cuadrillaId"><option value="">Cuadrilla</option>{cuadrillas.map((cuadrilla) => <option key={cuadrilla.id} value={cuadrilla.id}>{cuadrilla.nombre}</option>)}</select>
          <button className="btn btn-primary">Asignar</button>
        </div></form>
      )}

      {tiene(usuario, 'ordenes.trabajar') && orden.estado === 'ASIGNADA' && (
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-success" onClick={() => accion(api.post(`/ordenes/${id}/aceptar`), 'Asignación aceptada')}>Aceptar</button>
          <input className="form-control" placeholder="Motivo de rechazo" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
          <button type="button" className="btn btn-outline-danger" onClick={() => accion(api.post(`/ordenes/${id}/rechazar`, { motivo }), 'Asignación rechazada')}>Rechazar</button>
        </div>
      )}

      {tiene(usuario, 'ordenes.trabajar') && orden.estado === 'ACEPTADA' && (
        <div className="card"><div className="card-body d-grid gap-2">
          <h2 className="h6">Validar activo</h2>
          <div id="lector-qr" />
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => escanear().catch((errorEscaner) => notificar(mensajeError(errorEscaner) || 'No se pudo abrir la cámara', 'error'))}>Escanear QR</button>
            <input className="form-control" placeholder="Contenido del QR" value={qr} onChange={(evento) => setQr(evento.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => accion(api.post(`/ordenes/${id}/iniciar`, { contenido: qr }), 'Trabajo iniciado')}>Iniciar trabajo</button>
        </div></div>
      )}

      {tiene(usuario, 'ordenes.trabajar') && ['EN_PROCESO', 'RECHAZADA'].includes(orden.estado) && (
        <>
          {orden.estado === 'RECHAZADA' && <button type="button" className="btn btn-warning" onClick={() => accion(api.post(`/ordenes/${id}/reanudar`), 'Trabajo reanudado')}>Reanudar trabajo</button>}
          {plantilla && (
            <form className="card" onSubmit={async (evento) => {
              evento.preventDefault();
              const datos = new FormData(evento.currentTarget);
              const respuestas = plantilla.items.map((item) => ({
                itemId: item.id,
                cumplida: datos.get(`item-${item.id}`) === 'on',
                observacion: datos.get(`obs-${item.id}`) || '',
              }));
              const cuerpo = { plantillaId: plantilla.id, respuestas };
              const resultado = await enviarOEncolar(enLinea, crearOperacion({ tipo: 'CHECKLIST', ordenId: id, cuerpo, usuarioId: usuario.id }), () => api.post(`/ordenes/${id}/checklist`, cuerpo));
              notificar(resultado.encolado ? 'Checklist guardado para sincronizar' : 'Checklist registrado', resultado.encolado ? 'warning' : 'success');
              if (resultado.encolado) contexto.refrescarCola?.();
              if (!resultado.encolado) cargar();
            }}><div className="card-body d-grid gap-2">
              <h2 className="h6">{plantilla.nombre}</h2>
              {plantilla.items.map((item) => (
                <div key={item.id}>
                  <label className="form-check"><input className="form-check-input" type="checkbox" name={`item-${item.id}`} /> {item.texto} {item.obligatorio && <span className="text-danger">*</span>}</label>
                  <input className="form-control form-control-sm" name={`obs-${item.id}`} placeholder="Observación" />
                </div>
              ))}
              <button className="btn btn-primary">Guardar checklist</button>
            </div></form>
          )}
          <div className="card"><div className="card-body d-grid gap-2">
            <h2 className="h6">Diagnóstico y solución</h2>
            <textarea className="form-control" rows={3} value={diagnostico} onChange={(evento) => setDiagnostico(evento.target.value)} />
            <button type="button" className="btn btn-outline-primary" onClick={async () => {
              const resultado = await enviarOEncolar(enLinea, crearOperacion({ tipo: 'DIAGNOSTICO', ordenId: id, cuerpo: { diagnostico }, usuarioId: usuario.id }), () => api.post(`/ordenes/${id}/diagnostico`, { diagnostico }));
              notificar(resultado.encolado ? 'Diagnóstico en cola' : 'Diagnóstico registrado', resultado.encolado ? 'warning' : 'success');
              if (resultado.encolado) contexto.refrescarCola?.();
            }}>Guardar diagnóstico</button>
            <textarea className="form-control" rows={3} value={solucion} onChange={(evento) => setSolucion(evento.target.value)} />
            <button type="button" className="btn btn-outline-primary" onClick={async () => {
              const resultado = await enviarOEncolar(enLinea, crearOperacion({ tipo: 'SOLUCION', ordenId: id, cuerpo: { solucion }, usuarioId: usuario.id }), () => api.post(`/ordenes/${id}/solucion`, { solucion }));
              notificar(resultado.encolado ? 'Solución en cola' : 'Solución registrada', resultado.encolado ? 'warning' : 'success');
              if (resultado.encolado) contexto.refrescarCola?.();
            }}>Guardar solución</button>
          </div></div>
          <div className="card"><div className="card-body d-grid gap-2">
            <h2 className="h6">Repuestos utilizados</h2>
            <div className="d-flex gap-2">
              <select className="form-select" value={repuestoId} onChange={(evento) => setRepuestoId(evento.target.value)}><option value="">Repuesto</option>{repuestos.map((repuesto) => <option key={repuesto.id} value={repuesto.id}>{repuesto.codigo} — {repuesto.nombre} ({repuesto.stock})</option>)}</select>
              <input className="form-control" type="number" min="1" value={cantidad} onChange={(evento) => setCantidad(Number(evento.target.value))} />
            </div>
            <button type="button" className="btn btn-outline-primary" onClick={async () => {
              const items = [{ repuestoId, cantidad, clientMutationId: crypto.randomUUID() }];
              const resultado = await enviarOEncolar(enLinea, crearOperacion({ tipo: 'REPUESTOS', ordenId: id, cuerpo: { items }, usuarioId: usuario.id }), () => api.post(`/ordenes/${id}/repuestos`, { items }));
              notificar(resultado.encolado ? 'Consumo en cola' : 'Inventario actualizado', resultado.encolado ? 'warning' : 'success');
              if (resultado.encolado) contexto.refrescarCola?.();
              if (!resultado.encolado) cargar();
            }}>Declarar consumo</button>
            <ul className="mb-0">{(orden.movimientos || []).map((movimiento) => <li key={movimiento.id}>{movimiento.cantidad} × {movimiento.repuesto?.codigo}</li>)}</ul>
          </div></div>
          <div className="card"><div className="card-body d-grid gap-2">
            <h2 className="h6">Evidencias</h2>
            <input className="form-control" type="file" accept="image/*,application/pdf" capture="environment" onChange={async (evento) => {
              const archivo = evento.target.files?.[0];
              if (!archivo) return;
              if (!enLinea) {
                const operacion = crearOperacion({ tipo: 'EVIDENCIA', ordenId: id, cuerpo: { nombre: archivo.name }, usuarioId: usuario.id });
                await encolar(operacion, { blob: archivo, nombre: archivo.name });
                notificar('Fotografía guardada para sincronizar', 'warning');
                contexto.refrescarCola?.();
                return;
              }
              const formulario = new FormData();
              formulario.append('archivo', archivo);
              accion(api.post(`/ordenes/${id}/evidencias`, formulario), 'Evidencia adjuntada');
            }} />
            <ul className="mb-0">{(orden.evidencias || []).map((evidencia) => <li key={evidencia.id}><a href={`/api/evidencias/${evidencia.id}/archivo`} target="_blank" rel="noreferrer">{evidencia.nombreOriginal}</a></li>)}</ul>
          </div></div>
          {orden.estado === 'EN_PROCESO' && <button type="button" className="btn btn-dark" onClick={async () => {
            const resultado = await enviarOEncolar(enLinea, crearOperacion({ tipo: 'SOLICITAR_CIERRE', ordenId: id, usuarioId: usuario.id }), () => api.post(`/ordenes/${id}/solicitar-cierre`));
            notificar(resultado.encolado ? 'Cierre en cola. Se enviará después del diagnóstico, checklist, solución y evidencias.' : 'Cierre solicitado', resultado.encolado ? 'warning' : 'success');
            if (resultado.encolado) contexto.refrescarCola?.();
            if (!resultado.encolado) cargar();
          }}>Solicitar cierre</button>}
        </>
      )}

      {tiene(usuario, 'ordenes.aprobar') && orden.estado === 'PENDIENTE_APROBACION' && (
        <div className="card"><div className="card-body d-grid gap-2">
          <h2 className="h6">Revisión de cierre</h2>
          <p className="mb-1"><strong>Diagnóstico:</strong> {orden.diagnostico}</p>
          <p><strong>Solución:</strong> {orden.solucion}</p>
          {orden.prioridad === 'CRITICA' && (
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-dark" onClick={async () => {
                const { data } = await api.post('/tokens', { ordenId: id, minutos: 30 });
                setToken(data.token);
                notificar('Token temporal generado. Úselo de inmediato.');
              }}>Generar token</button>
              <input className="form-control" value={token} onChange={(evento) => setToken(evento.target.value)} placeholder="Token de cierre crítico" />
            </div>
          )}
          <textarea className="form-control" placeholder="Observaciones" value={observaciones} onChange={(evento) => setObservaciones(evento.target.value)} />
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success" onClick={() => accion(api.post(`/ordenes/${id}/aprobar`, { observaciones, token: token || undefined }), 'Cierre aprobado')}>Aprobar</button>
            <button type="button" className="btn btn-outline-danger" onClick={() => accion(api.post(`/ordenes/${id}/rechazar-cierre`, { observaciones }), 'Cierre rechazado')}>Rechazar</button>
          </div>
        </div></div>
      )}

      {tiene(usuario, 'ordenes.cancelar') && !['FINALIZADA', 'CANCELADA'].includes(orden.estado) && (
        <form className="d-flex gap-2" onSubmit={(evento) => { evento.preventDefault(); accion(api.post(`/ordenes/${id}/cancelar`, { motivo }), 'Orden cancelada'); }}>
          <input className="form-control" placeholder="Motivo de cancelación" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
          <button className="btn btn-outline-danger">Cancelar orden</button>
        </form>
      )}

      <div className="card"><div className="card-body">
        <h2 className="h6">Trazabilidad</h2>
        <ol className="mb-0">{(orden.historial || []).length === 0 && <Historial id={id} />}</ol>
      </div></div>
    </div>
  );
}

function Historial({ id }) {
  const [datos, setDatos] = useState([]);
  useEffect(() => { api.get(`/ordenes/${id}/historial`).then(({ data }) => setDatos(data.datos)); }, [id]);
  return datos.map((evento) => (
    <li key={evento.id}>{fecha(evento.creadoEn)} — {evento.estadoAnterior || 'Inicio'} → {evento.estadoNuevo} {evento.motivo ? `(${evento.motivo})` : ''}</li>
  ));
}
