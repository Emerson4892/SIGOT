import './helpers/load-env.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import test from 'node:test';
import { buzonLocal } from '../src/services/correo.js';
import { preparar, prisma } from './helpers/db.js';
import { agente, entrar, png } from './helpers/http.js';

test.before(async () => {
  await preparar();
});

test.after(async () => {
  await prisma.$disconnect();
});

test('el flujo operativo completo persiste en PostgreSQL', async () => {
  const admin = agente();
  const operador = agente();
  const supervisor = agente();
  const tecnico = agente();
  const bodega = agente();

  const sesionAdmin = await entrar(admin, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  assert.ok(sesionAdmin.usuario.permisos.includes('usuarios.escribir'));

  const cliente = await admin.post('/api/clientes').send({ nombre: 'Cliente Norte', nit: '1234567-8' });
  assert.equal(cliente.status, 201, JSON.stringify(cliente.body));
  const ubicacion = await admin.post('/api/ubicaciones').send({
    clienteId: cliente.body.id,
    nombre: 'Planta central',
    direccion: 'Km 12 carretera',
    ciudad: 'Guatemala',
  });
  assert.equal(ubicacion.status, 201, JSON.stringify(ubicacion.body));
  const tipo = await admin.post('/api/tipos-activo').send({ nombre: 'Bomba', descripcion: 'Equipo hidráulico' });
  assert.equal(tipo.status, 201, JSON.stringify(tipo.body));
  const activo = await admin.post('/api/activos').send({
    nombre: 'Bomba de alimentación',
    tipoActivoId: tipo.body.id,
    marca: 'Andina',
    modelo: 'B-20',
    serie: `SER-${Date.now()}`,
    clienteId: cliente.body.id,
    ubicacionId: ubicacion.body.id,
  });
  assert.equal(activo.status, 201, JSON.stringify(activo.body));
  assert.equal(activo.body.qrSecreto, undefined);

  const qr = await admin.get(`/api/activos/${activo.body.id}/qr-contenido`);
  assert.equal(qr.status, 200);
  assert.match(qr.body.contenido, /^SIGOT1\|/);
  const imagen = await admin.get(`/api/activos/${activo.body.id}/qr`);
  assert.equal(imagen.status, 200, JSON.stringify(imagen.body));
  assert.match(String(imagen.headers['content-type']), /^image\/png/);

  await entrar(operador, 'operador@sigot.local', 'SEED_OPERATOR_PASSWORD');
  const usuariosProhibidos = await operador.post('/api/usuarios').send({
    correo: 'intruso@sigot.local', contrasena: 'NoDebe123!', nombre: 'Intruso', apellido: 'Prueba', roles: ['OPERADOR'],
  });
  assert.equal(usuariosProhibidos.status, 403);

  const incidente = await operador.post('/api/incidentes').send({
    activoId: activo.body.id,
    descripcion: 'La bomba no alcanza la presión de operación.',
    prioridad: 'ALTA',
  });
  assert.equal(incidente.status, 201, JSON.stringify(incidente.body));
  const orden = await operador.post(`/api/incidentes/${incidente.body.id}/convertir`);
  assert.equal(orden.status, 201, JSON.stringify(orden.body));
  assert.equal(orden.body.estado, 'PENDIENTE');
  assert.equal(orden.body.activo.qrSecreto, undefined);

  await entrar(supervisor, 'supervisor@sigot.local', 'SEED_SUPERVISOR_PASSWORD');
  const tecnicoDb = await prisma.tecnico.findFirst({ where: { usuario: { correo: 'tecnico@sigot.local' } } });
  const asignacion = await supervisor.post(`/api/ordenes/${orden.body.id}/asignar`).send({ tecnicoId: tecnicoDb.id });
  assert.equal(asignacion.status, 200, JSON.stringify(asignacion.body));
  assert.equal(asignacion.body.estado, 'ASIGNADA');

  const sesionTecnico = await entrar(tecnico, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  const ajenas = await tecnico.get('/api/ordenes');
  assert.equal(ajenas.status, 200);
  assert.ok(ajenas.body.datos.some((item) => item.id === orden.body.id));

  const otra = await operador.post('/api/ordenes').send({
    activoId: activo.body.id,
    titulo: 'Orden no asignada',
    descripcion: 'Esta orden pertenece a otro flujo.',
    prioridad: 'BAJA',
  });
  assert.equal(otra.status, 201, JSON.stringify(otra.body));
  const prohibida = await tecnico.get(`/api/ordenes/${otra.body.id}`);
  assert.equal(prohibida.status, 404);

  const aceptada = await tecnico.post(`/api/ordenes/${orden.body.id}/aceptar`);
  assert.equal(aceptada.status, 200, JSON.stringify(aceptada.body));
  assert.equal(aceptada.body.estado, 'ACEPTADA');

  const qrMal = await tecnico.post('/api/activos/validar-qr').send({ ordenId: orden.body.id, contenido: 'SIGOT1|x|y|z' });
  assert.equal(qrMal.status, 422);
  const qrOk = await tecnico.post('/api/activos/validar-qr').send({ ordenId: orden.body.id, contenido: qr.body.contenido });
  assert.equal(qrOk.status, 200, JSON.stringify(qrOk.body));
  const iniciada = await tecnico.post(`/api/ordenes/${orden.body.id}/iniciar`).send({ contenido: qr.body.contenido });
  assert.equal(iniciada.status, 200, JSON.stringify(iniciada.body));
  assert.equal(iniciada.body.estado, 'EN_PROCESO');

  const plantillas = await tecnico.get('/api/checklists/plantillas');
  const plantilla = plantillas.body.datos[0];
  const checklist = await tecnico.post(`/api/ordenes/${orden.body.id}/checklist`).send({
    plantillaId: plantilla.id,
    respuestas: plantilla.items.map((item) => ({ itemId: item.id, cumplida: true, observacion: 'Conforme' })),
  });
  assert.equal(checklist.status, 200, JSON.stringify(checklist.body));

  const diagnostico = await tecnico.post(`/api/ordenes/${orden.body.id}/diagnostico`).send({
    diagnostico: 'Sello mecánico desgastado y pérdida de presión.',
  });
  assert.equal(diagnostico.status, 200, JSON.stringify(diagnostico.body));
  const idSync = randomUUID();
  const lote = {
    operaciones: [{
      id: idSync,
      tipo: 'DIAGNOSTICO',
      ordenId: orden.body.id,
      cuerpo: { diagnostico: 'Diagnóstico sincronizado desde la cola local.' },
    }],
  };
  const sincronizado = await tecnico.post('/api/sync').send(lote);
  const sincronizadoOtraVez = await tecnico.post('/api/sync').send(lote);
  assert.equal(sincronizado.body.resultados[0].ok, true, JSON.stringify(sincronizado.body));
  assert.equal(sincronizadoOtraVez.body.resultados[0].ok, true, JSON.stringify(sincronizadoOtraVez.body));
  const solucion = await tecnico.post(`/api/ordenes/${orden.body.id}/solucion`).send({
    solucion: 'Se sustituyó el sello y se verificó la presión nominal.',
  });
  assert.equal(solucion.status, 200, JSON.stringify(solucion.body));

  await entrar(bodega, 'bodega@sigot.local', 'SEED_WAREHOUSE_PASSWORD');
  const categorias = await bodega.get('/api/repuestos/categorias');
  const repuesto = await bodega.post('/api/repuestos').send({
    nombre: 'Sello mecánico',
    categoriaId: categorias.body.datos[0].id,
    stock: 0,
    stockMinimo: 1,
    ubicacionAlmacen: 'Estante A',
  });
  assert.equal(repuesto.status, 201, JSON.stringify(repuesto.body));
  const entrada = await bodega.post('/api/movimientos').send({
    repuestoId: repuesto.body.id,
    tipo: 'ENTRADA',
    cantidad: 4,
  });
  assert.equal(entrada.status, 201, JSON.stringify(entrada.body));
  const repuestoId = entrada.body.repuestoId;
  const negativo = await bodega.post('/api/movimientos').send({ repuestoId, tipo: 'SALIDA', cantidad: 50 });
  assert.equal(negativo.status, 409);

  const clave = randomUUID();
  const consumo = await tecnico.post(`/api/ordenes/${orden.body.id}/repuestos`)
    .set('X-Idempotency-Key', clave)
    .send({ items: [{ repuestoId, cantidad: 1, clientMutationId: randomUUID() }] });
  assert.equal(consumo.status, 200, JSON.stringify(consumo.body));
  const repetido = await tecnico.post(`/api/ordenes/${orden.body.id}/repuestos`)
    .set('X-Idempotency-Key', clave)
    .send({ items: [{ repuestoId, cantidad: 1 }] });
  assert.equal(repetido.status, 200);
  const stock = await prisma.repuesto.findUnique({ where: { id: repuestoId } });
  assert.equal(stock.stock, 3);

  const sinEvidencia = await tecnico.post(`/api/ordenes/${orden.body.id}/solicitar-cierre`);
  assert.equal(sinEvidencia.status, 422);

  const evidencia = await tecnico.post(`/api/ordenes/${orden.body.id}/evidencias`)
    .attach('archivo', png, { filename: 'bomba.png', contentType: 'image/png' });
  assert.equal(evidencia.status, 201, JSON.stringify(evidencia.body));
  const archivo = await supervisor.get(`/api/evidencias/${evidencia.body.id}/archivo`);
  assert.equal(archivo.status, 200);
  assert.equal(archivo.headers['content-type'], 'image/png');

  const cierre = await tecnico.post(`/api/ordenes/${orden.body.id}/solicitar-cierre`);
  assert.equal(cierre.status, 200, JSON.stringify(cierre.body));
  assert.equal(cierre.body.estado, 'PENDIENTE_APROBACION');
  const auto = await tecnico.post(`/api/ordenes/${orden.body.id}/aprobar`).send({});
  assert.equal(auto.status, 403);

  const aprobada = await supervisor.post(`/api/ordenes/${orden.body.id}/aprobar`).send({
    observaciones: 'Trabajo verificado en sitio.',
  });
  assert.equal(aprobada.status, 200, JSON.stringify(aprobada.body));
  assert.equal(aprobada.body.estado, 'FINALIZADA');

  const historial = await supervisor.get(`/api/activos/${activo.body.id}/historial`);
  assert.equal(historial.status, 200);
  const tipos = new Set(historial.body.datos.map((item) => item.tipo));
  for (const tipoHistorial of ['INCIDENTE', 'ORDEN', 'DIAGNOSTICO', 'REPARACION', 'REPUESTO', 'EVIDENCIA']) {
    assert.ok(tipos.has(tipoHistorial), `Falta historial ${tipoHistorial}`);
  }

  const cadena = await admin.get('/api/auditoria/verificar');
  assert.equal(cadena.status, 200, JSON.stringify(cadena.body));
  assert.equal(cadena.body.integra, true);
  assert.ok(cadena.body.total > 5);

  const tablero = await admin.get('/api/dashboard');
  assert.equal(tablero.status, 200, JSON.stringify(tablero.body));
  assert.ok(tablero.body.activos.total >= 1);
  assert.ok(tablero.body.ordenes.finalizadas >= 1);
  assert.equal(typeof tablero.body.sla.porcentaje, 'number');

  const exportado = await admin.get('/api/reportes/exportar');
  assert.equal(exportado.status, 200);
  assert.match(exportado.text, /Codigo/);

  assert.equal(sesionTecnico.usuario.tecnicoId, tecnicoDb.id);
});

test('el cierre crítico exige un token vigente y la recuperación de clave funciona', async () => {
  const admin = agente();
  const supervisor = agente();
  const tecnico = agente();
  await entrar(admin, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  const cliente = await admin.post('/api/clientes').send({ nombre: 'Cliente Crítico' });
  const ubicacion = await admin.post('/api/ubicaciones').send({
    clienteId: cliente.body.id, nombre: 'Sitio', direccion: 'Zona 1',
  });
  const tipo = await admin.post('/api/tipos-activo').send({ nombre: 'Tablero' });
  const activo = await admin.post('/api/activos').send({
    nombre: 'Tablero principal', tipoActivoId: tipo.body.id, clienteId: cliente.body.id, ubicacionId: ubicacion.body.id,
  });
  const qr = await admin.get(`/api/activos/${activo.body.id}/qr-contenido`);
  const incidente = await admin.post('/api/incidentes').send({
    activoId: activo.body.id, descripcion: 'Falla crítica de alimentación eléctrica.', prioridad: 'CRITICA',
  });
  const orden = await admin.post(`/api/incidentes/${incidente.body.id}/convertir`);
  const tecnicoDb = await prisma.tecnico.findFirst({ where: { usuario: { correo: 'tecnico@sigot.local' } } });
  await entrar(supervisor, 'supervisor@sigot.local', 'SEED_SUPERVISOR_PASSWORD');
  await supervisor.post(`/api/ordenes/${orden.body.id}/asignar`).send({ tecnicoId: tecnicoDb.id });
  await entrar(tecnico, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  await tecnico.post(`/api/ordenes/${orden.body.id}/aceptar`);
  await tecnico.post(`/api/ordenes/${orden.body.id}/iniciar`).send({ contenido: qr.body.contenido });
  const plantilla = (await tecnico.get('/api/checklists/plantillas')).body.datos[0];
  await tecnico.post(`/api/ordenes/${orden.body.id}/checklist`).send({
    plantillaId: plantilla.id,
    respuestas: plantilla.items.map((item) => ({ itemId: item.id, cumplida: true })),
  });
  await tecnico.post(`/api/ordenes/${orden.body.id}/diagnostico`).send({ diagnostico: 'Interruptor principal dañado.' });
  await tecnico.post(`/api/ordenes/${orden.body.id}/solucion`).send({ solucion: 'Se reemplazó el interruptor principal.' });
  await tecnico.post(`/api/ordenes/${orden.body.id}/evidencias`).attach('archivo', png, { filename: 'tablero.png', contentType: 'image/png' });
  const cierre = await tecnico.post(`/api/ordenes/${orden.body.id}/solicitar-cierre`);
  assert.equal(cierre.status, 200, JSON.stringify(cierre.body));
  const sinToken = await supervisor.post(`/api/ordenes/${orden.body.id}/aprobar`).send({ observaciones: 'Pendiente de token' });
  assert.equal(sinToken.status, 422);
  const emitido = await supervisor.post('/api/tokens').send({ ordenId: orden.body.id, minutos: 15 });
  assert.equal(emitido.status, 201, JSON.stringify(emitido.body));
  const aprobada = await supervisor.post(`/api/ordenes/${orden.body.id}/aprobar`).send({
    observaciones: 'Cierre crítico autorizado.',
    token: emitido.body.token,
  });
  assert.equal(aprobada.status, 200, JSON.stringify(aprobada.body));
  const reutilizado = await supervisor.post('/api/tokens').send({ ordenId: orden.body.id, minutos: 15 });
  assert.equal(reutilizado.status, 201);
  const revocado = await supervisor.post(`/api/tokens/${reutilizado.body.registro.id}/revocar`);
  assert.equal(revocado.status, 200);

  buzonLocal.limpiar();
  const recuperacion = await agente().post('/api/auth/recuperar').send({ correo: 'operador@sigot.local' });
  assert.equal(recuperacion.status, 200);
  const url = new URL(buzonLocal.ultimo().url);
  const token = url.searchParams.get('token');
  const nueva = 'OperadorNuevo1!';
  const restablecida = await agente().post('/api/auth/restablecer').send({ token, contrasena: nueva });
  assert.equal(restablecida.status, 200, JSON.stringify(restablecida.body));
  const ingreso = await agente().post('/api/auth/login').send({ correo: 'operador@sigot.local', contrasena: nueva });
  assert.equal(ingreso.status, 200, JSON.stringify(ingreso.body));
});

test('un usuario desactivado no conserva la sesión', async () => {
  const admin = agente();
  await entrar(admin, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  const creado = await admin.post('/api/usuarios').send({
    correo: 'temporal@sigot.local',
    contrasena: 'Temporal123!',
    nombre: 'Temporal',
    apellido: 'Prueba',
    roles: ['OPERADOR'],
  });
  assert.equal(creado.status, 201, JSON.stringify(creado.body));
  const temporal = agente();
  const sesion = await temporal.post('/api/auth/login').send({ correo: 'temporal@sigot.local', contrasena: 'Temporal123!' });
  assert.equal(sesion.status, 200, JSON.stringify(sesion.body));
  temporal.set('X-CSRF-Token', sesion.body.csrfToken);
  const desactivado = await admin.post(`/api/usuarios/${creado.body.id}/desactivar`);
  assert.equal(desactivado.status, 200, JSON.stringify(desactivado.body));
  const bloqueado = await temporal.get('/api/auth/perfil');
  assert.equal(bloqueado.status, 401);
  const reingreso = await agente().post('/api/auth/login').send({ correo: 'temporal@sigot.local', contrasena: 'Temporal123!' });
  assert.equal(reingreso.status, 403);
  const sinCsrf = await admin.post('/api/clientes').set('X-CSRF-Token', 'invalido').send({ nombre: 'No debe crearse' });
  assert.equal(sinCsrf.status, 403);
});

test('la sincronización no cierra antes de confirmar el trabajo previo', async () => {
  const admin = agente();
  const supervisor = agente();
  const tecnico = agente();
  await entrar(admin, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  const cliente = await admin.post('/api/clientes').send({ nombre: 'Cliente Sincronización' });
  const ubicacion = await admin.post('/api/ubicaciones').send({
    clienteId: cliente.body.id, nombre: 'Bodega', direccion: 'Calle 1',
  });
  const tipo = await admin.post('/api/tipos-activo').send({ nombre: 'Válvula' });
  const activo = await admin.post('/api/activos').send({
    nombre: 'Válvula de admisión', tipoActivoId: tipo.body.id, clienteId: cliente.body.id, ubicacionId: ubicacion.body.id,
  });
  const qr = await admin.get(`/api/activos/${activo.body.id}/qr-contenido`);
  const incidente = await admin.post('/api/incidentes').send({
    activoId: activo.body.id, descripcion: 'La válvula no cierra por completo.', prioridad: 'ALTA',
  });
  const orden = await admin.post(`/api/incidentes/${incidente.body.id}/convertir`);
  const tecnicoDb = await prisma.tecnico.findFirst({ where: { usuario: { correo: 'tecnico@sigot.local' } } });
  await entrar(supervisor, 'supervisor@sigot.local', 'SEED_SUPERVISOR_PASSWORD');
  await supervisor.post(`/api/ordenes/${orden.body.id}/asignar`).send({ tecnicoId: tecnicoDb.id });
  await entrar(tecnico, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  await tecnico.post(`/api/ordenes/${orden.body.id}/aceptar`);
  await tecnico.post(`/api/ordenes/${orden.body.id}/iniciar`).send({ contenido: qr.body.contenido });
  const plantilla = (await tecnico.get('/api/checklists/plantillas')).body.datos[0];
  await tecnico.post(`/api/ordenes/${orden.body.id}/checklist`).send({
    plantillaId: plantilla.id,
    respuestas: plantilla.items.map((item) => ({ itemId: item.id, cumplida: true })),
  });
  await tecnico.post(`/api/ordenes/${orden.body.id}/diagnostico`).send({
    diagnostico: 'Asiento de la válvula desgastado.',
  });
  await tecnico.post(`/api/ordenes/${orden.body.id}/solucion`).send({
    solucion: 'Se rectificó el asiento y se probó el cierre.',
  });
  await tecnico.post(`/api/ordenes/${orden.body.id}/evidencias`)
    .attach('archivo', png, { filename: 'valvula.png', contentType: 'image/png' });

  const idCierre = randomUUID();
  const idDiagnostico = randomUUID();
  const lote = await tecnico.post('/api/sync').send({
    operaciones: [
      { id: idCierre, tipo: 'SOLICITAR_CIERRE', ordenId: orden.body.id, cuerpo: {} },
      { id: idDiagnostico, tipo: 'DIAGNOSTICO', ordenId: orden.body.id, cuerpo: { diagnostico: 'corto' } },
    ],
  });
  assert.equal(lote.status, 200, JSON.stringify(lote.body));
  const porId = new Map(lote.body.resultados.map((item) => [item.id, item]));
  assert.equal(porId.get(idDiagnostico).ok, true, JSON.stringify(lote.body));
  assert.equal(porId.get(idCierre).ok, false, JSON.stringify(lote.body));
  assert.equal(porId.get(idCierre).codigo, 'CIERRE_INCOMPLETO');
  const abierta = await tecnico.get(`/api/ordenes/${orden.body.id}`);
  assert.equal(abierta.body.estado, 'EN_PROCESO');
  assert.equal(abierta.body.diagnostico, 'corto');

  const repetido = await tecnico.post('/api/sync').send({
    operaciones: [
      { id: idDiagnostico, tipo: 'DIAGNOSTICO', ordenId: orden.body.id, cuerpo: { diagnostico: 'corto' } },
      { id: idDiagnostico, tipo: 'DIAGNOSTICO', ordenId: orden.body.id, cuerpo: { diagnostico: 'Este texto no debe reemplazar el anterior.' } },
    ],
  });
  assert.equal(repetido.body.resultados.filter((item) => item.ok).length, 1);
  assert.equal(repetido.body.resultados.filter((item) => item.codigo === 'DUPLICADO').length, 1);
  const igual = await tecnico.get(`/api/ordenes/${orden.body.id}`);
  assert.equal(igual.body.diagnostico, 'corto');

  const pendiente = await admin.post('/api/ordenes').send({
    activoId: activo.body.id,
    titulo: 'Orden aún pendiente',
    descripcion: 'Esta orden no está en proceso.',
    prioridad: 'BAJA',
  });
  await entrar(tecnico, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  const idFallo = randomUUID();
  const idCierrePendiente = randomUUID();
  const bloqueado = await tecnico.post('/api/sync').send({
    operaciones: [
      { id: idCierrePendiente, tipo: 'SOLICITAR_CIERRE', ordenId: pendiente.body.id, cuerpo: {} },
      { id: idFallo, tipo: 'DIAGNOSTICO', ordenId: pendiente.body.id, cuerpo: { diagnostico: 'No corresponde porque la orden sigue pendiente.' } },
    ],
  });
  const resultadoBloqueo = new Map(bloqueado.body.resultados.map((item) => [item.id, item]));
  assert.equal(resultadoBloqueo.get(idFallo).ok, false);
  assert.equal(resultadoBloqueo.get(idCierrePendiente).codigo, 'DEPENDENCIA');
  const sinCambio = await admin.get(`/api/ordenes/${pendiente.body.id}`);
  assert.equal(sinCambio.body.estado, 'PENDIENTE');
});

test('las restricciones de inventario y auditoría quedan aplicadas por migraciones', async () => {
  const checks = await prisma.$queryRaw`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('repuestos_stock_no_negativo', 'movimientos_cantidad_positiva')
  `;
  assert.equal(checks.length, 2);
  const trigger = await prisma.$queryRaw`
    SELECT tgname FROM pg_trigger WHERE tgname = 'auditoria_inmutable' AND NOT tgisinternal
  `;
  assert.equal(trigger.length, 1);
});

test('el seed puede repetirse sin duplicar catálogos ni usuarios', async () => {
  const { execSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const antes = {
    usuarios: await prisma.usuario.count(),
    roles: await prisma.rol.count(),
    permisos: await prisma.permiso.count(),
    sla: await prisma.politicaSla.count(),
  };
  execSync('node prisma/seed.js', { cwd: backend, env: process.env, stdio: 'pipe' });
  assert.equal(await prisma.usuario.count(), antes.usuarios);
  assert.equal(await prisma.rol.count(), antes.roles);
  assert.equal(await prisma.permiso.count(), antes.permisos);
  assert.equal(await prisma.politicaSla.count(), antes.sla);
});
