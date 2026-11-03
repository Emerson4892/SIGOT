import { expect, test } from '@playwright/test';
import { cargarEntorno } from './entorno.js';

const entorno = cargarEntorno();

test.use({ viewport: { width: 390, height: 844 } });

test('la PWA se presenta como aplicación móvil instalable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(desborde).toBe(true);

  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toContain('manifest.webmanifest');
  const manifest = await page.evaluate(async (ruta) => {
    const respuesta = await fetch(ruta);
    return respuesta.json();
  }, manifestUrl);
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/tecnico');
  expect(manifest.icons.some((icono) => icono.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((icono) => icono.sizes === '512x512')).toBe(true);

  await page.locator('input[type="email"]').fill('tecnico@sigot.local');
  await page.locator('input[type="password"]').fill(entorno.SEED_TECHNICIAN_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Trabajo de campo' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sincronizar$/ })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration()))).toBe(true);
  await page.context().setOffline(true);
  await expect(page.getByText('Sin conexión')).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText('Sin conexión')).toBeHidden();
});

async function entrar(page, correo, variable) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(correo);
  await page.locator('input[type="password"]').fill(entorno[variable]);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function usuarioActivo(page) {
  return page.evaluate(() => localStorage.getItem('sigot-usuario-activo'));
}

async function basesSigot(page) {
  return page.evaluate(async () => {
    if (!indexedDB.databases) return [];
    const lista = await indexedDB.databases();
    return lista.map((item) => item.name).filter((nombre) => nombre && nombre.startsWith('sigot-u-'));
  });
}

async function encolarPendiente(page, diagnostico) {
  return page.evaluate(async (texto) => {
    const usuarioId = localStorage.getItem('sigot-usuario-activo');
    const nombre = `sigot-u-${usuarioId}`;
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(nombre, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('ordenes')) db.createObjectStore('ordenes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').put({
          id: crypto.randomUUID(),
          tipo: 'DIAGNOSTICO',
          ordenId: '22222222-2222-4222-8222-222222222222',
          usuarioId,
          cuerpo: { diagnostico: texto },
          creadoEn: new Date().toISOString(),
          intentos: 0,
          error: null,
          codigo: null,
          estado: 'pendiente',
          proximoIntento: null,
        });
        tx.oncomplete = () => { db.close(); resolve(usuarioId); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
    return usuarioId;
  }, diagnostico);
}

async function leerOutbox(page, usuarioId) {
  return page.evaluate(async (id) => {
    const nombre = `sigot-u-${id}`;
    return new Promise((resolve) => {
      const req = indexedDB.open(nombre, 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('outbox')) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction('outbox', 'readonly');
        const lectura = tx.objectStore('outbox').getAll();
        lectura.onsuccess = () => {
          db.close();
          resolve(lectura.result || []);
        };
        lectura.onerror = () => {
          db.close();
          resolve([]);
        };
      };
      req.onerror = () => resolve([]);
    });
  }, usuarioId);
}

test('cerrar sesión con pendientes las conserva y otro usuario no las ve', async ({ page }) => {
  const diagnostico = `Pendiente local ${Date.now()}`;
  await entrar(page, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  await expect(page.getByRole('heading', { name: 'Trabajo de campo' })).toBeVisible();
  await expect.poll(async () => usuarioActivo(page)).toBeTruthy();
  const tecnicoId = await encolarPendiente(page, diagnostico);
  const colaTecnico = await leerOutbox(page, tecnicoId);
  expect(colaTecnico.some((item) => item.cuerpo?.diagnostico === diagnostico)).toBe(true);

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('dialog')).toContainText(/pendiente/);
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  expect(await usuarioActivo(page)).toBeNull();
  expect(await basesSigot(page)).toContain(`sigot-u-${tecnicoId}`);
  expect((await leerOutbox(page, tecnicoId)).some((item) => item.cuerpo?.diagnostico === diagnostico)).toBe(true);

  await entrar(page, 'admin@sigot.local', 'SEED_ADMIN_PASSWORD');
  await page.goto('/tecnico');
  await expect(page.getByRole('heading', { name: 'Trabajo de campo' })).toBeVisible();
  const adminId = await usuarioActivo(page);
  expect(adminId).toBeTruthy();
  expect(adminId).not.toBe(tecnicoId);
  await page.getByRole('link', { name: /Sincronizar$/ }).click();
  await expect(page.getByText('No hay operaciones pendientes.')).toBeVisible();
  await expect(page.getByText(diagnostico)).toHaveCount(0);
  expect(await basesSigot(page)).toContain(`sigot-u-${tecnicoId}`);

  await page.getByRole('button', { name: 'Salir' }).click();
  const confirmarAdmin = page.getByRole('dialog').getByRole('button', { name: 'Confirmar' });
  if (await confirmarAdmin.count()) await confirmarAdmin.click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await entrar(page, 'tecnico@sigot.local', 'SEED_TECHNICIAN_PASSWORD');
  await page.getByRole('link', { name: /Sincronizar$/ }).click();
  await expect(page.getByText('DIAGNOSTICO')).toBeVisible();
  await expect(page.getByText('No hay operaciones pendientes.')).toHaveCount(0);
  expect((await leerOutbox(page, tecnicoId)).some((item) => item.cuerpo?.diagnostico === diagnostico)).toBe(true);
});
