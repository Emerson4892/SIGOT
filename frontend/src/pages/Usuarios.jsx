import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, mensajeError } from '../services/api.js';
import { Alerta, Busqueda, Cargando, Modal, Paginacion, Vacio, useConfirmar } from '../components/ui.jsx';
import { useNotify } from '../contexts/NotifyContext.jsx';
import { fecha, tiene } from '../utils/formato.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function Usuarios() {
  const { usuario: sesion } = useAuth();
  const notificar = useNotify();
  const { confirmar, dialogo } = useConfirmar();
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  async function cargar() {
    try {
      const { data } = await api.get('/usuarios', { params: { q, pagina, tamano: 10 } });
      setLista(data);
    } catch (errorCarga) {
      setError(mensajeError(errorCarga));
    }
  }
  useEffect(() => { cargar(); }, [q, pagina]);
  useEffect(() => { api.get('/roles').then(({ data }) => setRoles(data.datos)); }, []);

  function abrir(usuario) {
    reset(usuario ? {
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono || '',
      roles: usuario.roles.map((rol) => rol.codigo),
    } : { roles: [] });
    setModal(usuario || {});
  }

  return (
    <div>
      <div className="d-flex justify-content-between mb-3"><h1 className="h3">Usuarios</h1>{tiene(sesion, 'usuarios.escribir') && <button className="btn btn-primary" type="button" onClick={() => abrir(null)}>Nuevo usuario</button>}</div>
      <div className="card"><div className="card-body">
        <div className="col-md-4 mb-3"><Busqueda onChange={setQ} /></div>
        <Alerta>{error}</Alerta>
        {!lista ? <Cargando /> : lista.datos.length === 0 ? <Vacio texto="No hay usuarios." /> : (
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Nombre</th><th>Correo</th><th>Roles</th><th>Estado</th><th>Último acceso</th><th /></tr></thead>
            <tbody>{lista.datos.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nombre} {usuario.apellido}</td>
                <td>{usuario.correo}</td>
                <td>{usuario.roles.map((rol) => rol.nombre).join(', ')}</td>
                <td>{usuario.activo ? 'Activo' : 'Inactivo'}</td>
                <td>{fecha(usuario.ultimoAcceso)}</td>
                <td className="text-end">
                  {tiene(sesion, 'usuarios.escribir') && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => abrir(usuario)}>Editar</button>}
                  {tiene(sesion, 'usuarios.desactivar') && <button type="button" className="btn btn-sm btn-outline-secondary ms-2" onClick={async () => {
                    const ruta = usuario.activo ? 'desactivar' : 'activar';
                    if (!(await confirmar(`¿${usuario.activo ? 'Desactivar' : 'Activar'} a ${usuario.nombre}?`))) return;
                    try {
                      await api.post(`/usuarios/${usuario.id}/${ruta}`);
                      notificar('Usuario actualizado');
                      cargar();
                    } catch (errorAccion) { notificar(mensajeError(errorAccion), 'error'); }
                  }}>{usuario.activo ? 'Desactivar' : 'Activar'}</button>}
                </td>
              </tr>
            ))}</tbody></table></div>
        )}
        <Paginacion meta={lista?.meta} onChange={setPagina} />
      </div></div>
      <Modal titulo={modal?.id ? 'Editar usuario' : 'Nuevo usuario'} abierto={Boolean(modal)} onClose={() => setModal(null)}>
        <form onSubmit={handleSubmit(async (datos) => {
          const rolesSeleccionados = [].concat(datos.roles || []);
          try {
            if (modal.id) {
              await api.patch(`/usuarios/${modal.id}`, { nombre: datos.nombre, apellido: datos.apellido, telefono: datos.telefono });
              await api.put(`/usuarios/${modal.id}/roles`, { roles: rolesSeleccionados });
            } else {
              await api.post('/usuarios', { ...datos, roles: rolesSeleccionados });
            }
            setModal(null);
            notificar('Usuario guardado');
            cargar();
          } catch (errorGuardar) { notificar(mensajeError(errorGuardar), 'error'); }
        })}>
          <div className="modal-body d-grid gap-3">
            {!modal?.id && <div><label className="form-label">Correo</label><input className="form-control" type="email" {...register('correo', { required: true })} /></div>}
            {!modal?.id && <div><label className="form-label">Contraseña temporal</label><input className="form-control" type="password" {...register('contrasena', { required: true })} /></div>}
            <div><label className="form-label">Nombre</label><input className="form-control" {...register('nombre', { required: true })} /></div>
            <div><label className="form-label">Apellido</label><input className="form-control" {...register('apellido', { required: true })} /></div>
            <div><label className="form-label">Teléfono</label><input className="form-control" {...register('telefono')} /></div>
            <div>
              <div className="form-label">Roles</div>
              {roles.map((rol) => (
                <label key={rol.id} className="form-check">
                  <input className="form-check-input" type="checkbox" value={rol.codigo} {...register('roles')} /> {rol.nombre}
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
        </form>
      </Modal>
      {dialogo}
    </div>
  );
}

export function Roles() {
  const notificar = useNotify();
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [rol, setRol] = useState(null);
  const [seleccion, setSeleccion] = useState([]);
  useEffect(() => {
    api.get('/roles').then(({ data }) => setRoles(data.datos));
    api.get('/permisos').then(({ data }) => setPermisos(data.datos));
  }, []);
  function elegir(item) {
    setRol(item);
    setSeleccion(item.permisos);
  }
  const modulos = [...new Set(permisos.map((permiso) => permiso.modulo))];
  return (
    <div className="row g-3">
      <div className="col-md-4"><div className="card"><div className="list-group list-group-flush">
        {roles.map((item) => <button type="button" key={item.id} className={`list-group-item list-group-item-action ${rol?.id === item.id ? 'active' : ''}`} onClick={() => elegir(item)}>{item.nombre}</button>)}
      </div></div></div>
      <div className="col-md-8"><div className="card"><div className="card-body">
        {!rol ? <p className="text-secondary mb-0">Seleccione un rol para revisar sus permisos.</p> : (
          <form onSubmit={async (evento) => {
            evento.preventDefault();
            try {
              const actualizado = await api.put(`/roles/${rol.id}/permisos`, { permisos: seleccion });
              setRol(actualizado.data);
              setRoles((lista) => lista.map((item) => item.id === rol.id ? actualizado.data : item));
              notificar('Permisos actualizados');
            } catch (error) { notificar(mensajeError(error), 'error'); }
          }}>
            <h1 className="h4">{rol.nombre}</h1>
            <p className="text-secondary">{rol.descripcion}</p>
            {modulos.map((modulo) => (
              <div key={modulo} className="mb-3">
                <div className="fw-semibold text-uppercase small">{modulo}</div>
                {permisos.filter((permiso) => permiso.modulo === modulo).map((permiso) => (
                  <label key={permiso.id} className="form-check">
                    <input className="form-check-input" type="checkbox" checked={seleccion.includes(permiso.codigo)} onChange={(evento) => {
                      setSeleccion((actual) => evento.target.checked ? [...actual, permiso.codigo] : actual.filter((codigo) => codigo !== permiso.codigo));
                    }} /> {permiso.descripcion}
                  </label>
                ))}
              </div>
            ))}
            <button className="btn btn-primary">Guardar permisos</button>
          </form>
        )}
      </div></div></div>
    </div>
  );
}
