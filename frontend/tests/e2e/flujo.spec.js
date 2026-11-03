import { expect, test } from '@playwright/test';
import { cargarEntorno } from './entorno.js';

const entorno = cargarEntorno();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function clave(variable) {
  const valor = entorno[variable];
  if (!valor) throw new Error(`Falta ${variable} para la prueba de interfaz`);
  return valor;
}

function enlace(page, nombre) {
  return page.getByRole('link', { name: new RegExp(`${nombre}$`) });
}

async function entrar(page, correo, variable) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(correo);
  await page.locator('input[type="password"]').fill(clave(variable));
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function salir(page) {
  const salirCampo = page.getByRole('button', { name: 'Salir' });
  if (await salirCampo.count()) {
    await salirCampo.click();
  } else {
    await page.getByRole('button', { name: /Demo$/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  }
  const confirmar = page.getByRole('dialog').getByRole('button', { name: 'Confirmar' });
  if (await confirmar.count()) await confirmar.click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
}

async function basesLocales(page) {
  return page.evaluate(async () => {
    if (!indexedDB.databases) return [];
    const lista = await indexedDB.databases();
    return lista.map((item) => item.name).filter((nombre) => nombre && (nombre.startsWith('sigot-u-') || nombre === 'sigot-campo'));
  });
}

function control(contenedor, etiqueta) {
  return contenedor.locator('label').filter({ hasText: new RegExp(`^${etiqueta}$`) }).locator('xpath=following-sibling::*[1]');
}

async function crear(page, boton, campos) {
  await page.getByRole('button', { name: boton }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  for (const [etiqueta, valor, tipo] of campos) {
    const entrada = control(dialogo, etiqueta);
    if (tipo === 'select') {
      const busqueda = valor.label instanceof RegExp ? valor.label : new RegExp(`^${valor.label}$`);
      const opcion = entrada.locator('option').filter({ hasText: busqueda });
      await entrada.selectOption(await opcion.getAttribute('value'));
    } else await entrada.fill(valor);
  }
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
}

test('el flujo operativo completo persiste desde la interfaz', async ({ page }) => {
  const marca = Date.now();
  const cliente = `Cliente flujo ${marca}`;
  const ubicacion = `Planta ${marca}`;
  const tipo = `Bomba ${marca}`;
  const activo = `Bomba de alimentación ${marca}`;
  const repuesto = `Sello ${marca}`;

  await entrar(page, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  await enlace(page, 'Clientes').click();
  await crear(page, 'Nuevo', [['Nombre', cliente]]);
  await expect(page.getByRole('cell', { name: cliente })).toBeVisible();

  await enlace(page, 'Ubicaciones').click();
  await crear(page, 'Nuevo', [
    ['Cliente', { label: cliente }, 'select'],
    ['Nombre', ubicacion],
    ['Dirección', 'Km 12'],
    ['Ciudad', 'Guatemala'],
  ]);
  await expect(page.getByRole('cell', { name: ubicacion })).toBeVisible();

  await enlace(page, 'Tipos de activo').click();
  await crear(page, 'Nuevo', [['Nombre', tipo], ['Descripción', 'Equipo hidráulico de prueba']]);
  await expect(page.getByRole('cell', { name: tipo })).toBeVisible();

  await enlace(page, 'Activos').click();
  await page.getByRole('button', { name: 'Registrar activo' }).click();
  const dialogoActivo = page.getByRole('dialog');
  await control(dialogoActivo, 'Nombre').fill(activo);
  await control(dialogoActivo, 'Tipo').selectOption({ label: tipo });
  await control(dialogoActivo, 'Marca').fill('Andina');
  await control(dialogoActivo, 'Modelo').fill('B-20');
  await control(dialogoActivo, 'Serie').fill(`SER-${marca}`);
  await control(dialogoActivo, 'Cliente').selectOption({ label: cliente });
  await expect(control(dialogoActivo, 'Ubicación').locator('option', { hasText: ubicacion })).toHaveCount(1);
  await control(dialogoActivo, 'Ubicación').selectOption({ label: ubicacion });
  await dialogoActivo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogoActivo).toBeHidden();
  await expect(page.getByRole('cell', { name: activo })).toBeVisible();
  await page.getByRole('row', { name: new RegExp(activo) }).getByRole('button', { name: 'QR' }).click();
  const contenidoQr = (await page.getByRole('dialog').locator('p').innerText()).trim();
  expect(contenidoQr).toMatch(/^SIGOT1\|/);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await enlace(page, 'Modo campo').click();
  await expect(page.getByRole('heading', { name: 'Trabajo de campo' })).toBeVisible();
  let baseAdmin = '';
  await expect.poll(async () => {
    const bases = await basesLocales(page);
    baseAdmin = bases.find((nombre) => nombre.startsWith('sigot-u-')) || '';
    return baseAdmin;
  }).not.toBe('');
  expect(await basesLocales(page)).not.toContain('sigot-campo');
  await salir(page);
  await expect.poll(() => basesLocales(page)).toEqual([]);

  await entrar(page, 'operador@sigot.local', 'SEED_OPERATOR_PASSWORD');
  await enlace(page, 'Incidentes').click();
  await crear(page, 'Registrar incidente', [
    ['Activo', { label: new RegExp(activo) }, 'select'],
    ['Descripción', 'La bomba no alcanza la presión de operación.'],
  ]);
  await page.getByRole('row', { name: /INC-/ }).getByRole('button', { name: 'Crear orden' }).click();
  await expect(page).toHaveURL(/\/ordenes\/[0-9a-f-]+$/);
  const ordenUrl = page.url();
  await salir(page);

  await entrar(page, 'supervisor@sigot.local', 'SEED_SUPERVISOR_PASSWORD');
  await page.goto(ordenUrl);
  await expect(page.locator('select[name="tecnicoId"] option', { hasText: 'Tecnico Demo' })).toHaveCount(1);
  const opcionTecnico = page.locator('select[name="tecnicoId"] option', { hasText: 'Tecnico Demo' });
  await page.locator('select[name="tecnicoId"]').selectOption(await opcionTecnico.getAttribute('value'));
  await page.getByRole('button', { name: 'Asignar' }).click();
  await expect(page.getByText('Asignada', { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  let baseTecnico = '';
  await expect.poll(async () => {
    const bases = await basesLocales(page);
    baseTecnico = bases.find((nombre) => nombre.startsWith('sigot-u-')) || '';
    return baseTecnico && baseTecnico !== baseAdmin;
  }).toBeTruthy();
  expect(await basesLocales(page)).not.toContain('sigot-campo');
  expect(await basesLocales(page)).not.toContain(baseAdmin);
  await enlace(page, 'Órdenes').click();
  await page.getByRole('link', { name: 'Abrir' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByRole('button', { name: 'Escanear QR' })).toBeVisible();
  await page.getByPlaceholder('Contenido del QR').fill(contenidoQr);
  await page.getByRole('button', { name: 'Iniciar trabajo' }).click();
  await expect(page.getByText('En proceso', { exact: true })).toBeVisible();
  const checklist = page.locator('form.card', { hasText: 'Inspección general de activo' });
  for (const casilla of await checklist.getByRole('checkbox').all()) await casilla.check();
  await checklist.getByRole('button', { name: 'Guardar checklist' }).click();
  await expect(page.getByText('Checklist registrado')).toBeVisible();
  const trabajo = page.locator('.card', { hasText: 'Diagnóstico y solución' });
  await trabajo.locator('textarea').nth(0).fill('Sello mecánico desgastado y pérdida de presión.');
  await trabajo.getByRole('button', { name: 'Guardar diagnóstico' }).click();
  await expect(page.getByText('Diagnóstico registrado')).toBeVisible();
  await trabajo.locator('textarea').nth(1).fill('Se sustituyó el sello y se verificó la presión nominal.');
  await trabajo.getByRole('button', { name: 'Guardar solución' }).click();
  await expect(page.getByText('Solución registrada')).toBeVisible();
  await salir(page);

  await entrar(page, 'bodega@sigot.local', 'SEED_WAREHOUSE_PASSWORD');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const dialogo = page.getByRole('dialog');
  await control(dialogo, 'Nombre').fill(repuesto);
  await control(dialogo, 'Categoría').selectOption({ label: 'General' });
  await control(dialogo, 'Stock inicial').fill('4');
  await control(dialogo, 'Stock mínimo').fill('1');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('row', { name: new RegExp(repuesto) }).getByRole('cell').nth(2)).toHaveText('4');
  await salir(page);

  await entrar(page, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  await page.goto(ordenUrl.replace('/ordenes/', '/tecnico/ordenes/'));
  const consumo = page.locator('.card', { hasText: 'Repuestos utilizados' });
  const opcionRepuesto = consumo.locator('select option').filter({ hasText: repuesto });
  await consumo.locator('select').selectOption(await opcionRepuesto.getAttribute('value'));
  await consumo.locator('input[type="number"]').fill('1');
  await consumo.getByRole('button', { name: 'Declarar consumo' }).click();
  await expect(page.getByText('Inventario actualizado')).toBeVisible();
  await expect(consumo).toContainText(/1 ×/);
  const evidencia = page.locator('input[type="file"]');
  await expect(evidencia).toHaveAttribute('capture', 'environment');
  await evidencia.setInputFiles({ name: 'bomba.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('link', { name: 'bomba.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Solicitar cierre' }).click();
  await expect(page.getByText('Pendiente de aprobación', { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, 'supervisor@sigot.local', 'SEED_SUPERVISOR_PASSWORD');
  await page.goto(ordenUrl);
  await page.getByPlaceholder('Observaciones').fill('Trabajo verificado en sitio.');
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();

  await page.goto('/repuestos');
  await expect(page.getByRole('row', { name: new RegExp(repuesto) }).getByRole('cell').nth(2)).toHaveText('3');
  await enlace(page, 'Activos').click();
  await page.getByRole('row', { name: new RegExp(activo) }).getByRole('link', { name: 'Historial' }).click();
  await expect(page.getByText(/Sello mecánico desgastado/)).toBeVisible();
  await expect(page.getByText(/Se sustituyó el sello/)).toBeVisible();
  await enlace(page, 'Auditoría').click();
  await page.getByRole('button', { name: 'Verificar integridad' }).click();
  await expect(page.getByText(/Cadena íntegra/)).toBeVisible();
});
