# Informe de auditoría — SIGOT

Fecha de la revisión: 1 de noviembre de 2026. El trabajo se hizo sobre el proyecto existente. No se creó otro sistema, no se eliminaron módulos y no hubo despliegue en DigitalOcean.

## Requisitos implementados

Los 18 módulos siguen en la misma arquitectura: pantalla React, ruta, controlador, servicio, PostgreSQL, validación, permisos y manejo de errores.

1. Usuarios, roles y permisos.
2. Clientes y ubicaciones.
3. Activos e infraestructura, con QR.
4. Tipos de activo.
5. Incidentes.
6. Órdenes de trabajo.
7. Prioridades y SLA.
8. Cuadrillas y técnicos.
9. Asignaciones.
10. Inventario de repuestos.
11. Movimientos de repuestos.
12. Checklists técnicos. Las plantillas inactivas ya no se ofrecen al técnico.
13. Evidencias y archivos.
14. Mantenimientos preventivos.
15. Historial de activo.
16. Aprobaciones y cierres.
17. Dashboard y reportes.
18. Auditoría.

La cola offline implementa orden, reintentos, identificador de idempotencia, clasificación de errores y conflictos, prevención de duplicados y conservación de lo que el servidor no confirmó. La base local queda aislada por técnico. Si hay operaciones pendientes, cerrar sesión las conserva; otro usuario no las ve. El Service Worker no almacena respuestas de `/api`.

`docker-compose.prod.yml` prepara cookies seguras, secretos por variables de entorno, PostgreSQL sin puerto público, usuarios de demostración apagados, proxy HTTP de arranque con ACME, TLS cuando existe el certificado, persistencia de datos y evidencias, y healthchecks. El Compose local se mantiene en HTTP para el desarrollo.

## Requisitos verificados

Verificado aquí significa que la prueba se ejecutó en esta revisión y terminó bien.

- El flujo de API contra PostgreSQL, incluida la regla de que un cierre del mismo lote no se aplica si el diagnóstico previo falla.
- El flujo de interfaz en Chromium, contra la base `sigot_test`, con datos creados por la propia prueba.
- La cola: orden, evidencia antes del cierre, reintento, duplicado y operación de otro técnico que no se envía.
- Cerrar sesión con operaciones pendientes: la cola se conserva; el administrador no la ve; el técnico la recupera al volver a entrar.
- El manifest, el registro del Service Worker, la vista de 390×844 y el aviso de pérdida de conexión.
- Migraciones aplicadas (esquema + restricciones) y PostgreSQL del Compose local en estado healthy.
- Seed sin leer `database/restricciones.sql`, repetible, sin duplicar usuarios ni roles.
- Arranque del backend Docker sobre una base nueva y reinicio del contenedor sobre la base existente sin perder los 5 usuarios de demostración.
- Sintaxis de `docker-compose.yml` y de `docker-compose.prod.yml`.
- Stack local completo: backend `/api/salud` 200, frontend `http://localhost:8080` 200.

## Pruebas ejecutadas

Resultado final de esta revisión:

| Suite | Resultado |
| --- | --- |
| `backend`: `npm test` | 10 pruebas pasaron |
| `frontend`: `npm test` | 9 pruebas pasaron |
| `frontend`: `npm run build` | compiló y generó `dist/sw.js` |
| Playwright `flujo.spec.js` y `pwa.spec.js` | 3 pruebas pasaron |
| `npx prisma migrate deploy` en contenedor sobre base existente | 2 migraciones, ninguna pendiente |
| Contenedor backend sobre PostgreSQL vacío | aplicó `init` y `restricciones`, sembró roles, API en ejecución |
| PostgreSQL, backend y frontend en `docker compose up --build` | los tres servicios healthy |
| `docker compose restart backend` | 5 usuarios y 5 roles se conservaron |
| `docker compose -f docker-compose.prod.yml config` | válido |
| `npm audit` backend (`omit=dev` y completo) | 4 avisos high; ver riesgos |
| `npm audit` frontend de producción (`omit=dev`) | 0 avisos |
| `npm audit` frontend con dependencias de desarrollo | 10 avisos (2 low, 8 moderate) |

La primera pasada de Playwright falló porque Chromium de esa versión no estaba descargado (`npx playwright install chromium`). Tras instalarlo, el flujo y la PWA pasaron. La prueba nueva de cierre de sesión falló después por el límite de inicios de sesión (10 en 15 minutos) del backend de Playwright, que corre con `NODE_ENV=development`. Se cambió ese servidor de prueba a `NODE_ENV=test` para omitir el límite, igual que el resto de la suite de API. La pasada final de las tres pruebas de interfaz pasó. No quedaron fallos abiertos en las suites ejecutadas.

`nginx -t` lanzado fuera de la red de Compose no resuelve el nombre `frontend`. Dentro de Compose ese nombre es el servicio del panel. No se levantó el Compose de producción ni se pidió un certificado real.

La prueba de interfaz comprobó el stock en 4 al crear el repuesto y en 3 después del consumo y de la aprobación. El descuento ocurre al declarar el consumo; la aprobación no lo vuelve a descontar.

## Pruebas fallidas

No hay pruebas fallidas en la pasada final.

Siguen sin ejecutarse, y por eso no se presentan como superadas:

- Instalación de la PWA en un teléfono.
- Uso real de la cámara y lectura óptica del QR. La prueba sí pulsó el campo y comprobó `capture="environment"`, con el contenido del QR escrito a mano.
- Ventana instalada en modo `standalone`. El manifest lo declara; Chromium de la prueba no estaba instalado como aplicación.
- Encolar un trabajo con la red caída y sincronizarlo al volver, dentro del navegador. La conservación de pendientes al salir sí se recorrió en Chromium inyectando la cola local.
- Alta de cuadrilla, movimiento manual de bodega, programación de mantenimiento preventivo, edición de SLA y exportación de reportes desde la pantalla.
- Arranque del Compose de producción y emisión real de Let's Encrypt.
- El workflow de GitHub Actions en GitHub (el archivo existe; no se disparó un run remoto).
- Despliegue externo.

## Vulnerabilidades encontradas

- El seed del backend leía `database/restricciones.sql`, un archivo que no entra en la imagen Docker. El contenedor no podía arrancar en una base nueva. Corregido: las restricciones viven en la migración `20261101063000_restricciones` y el seed ya no abre ese archivo.
- Cerrar sesión o expirar la sesión autenticada borraba IndexedDB aunque hubiera operaciones sin sincronizar. Corregido: se conservan si hay pendientes y se aíslan por `sigot-u-<id>`.
- El proxy de producción exigía `TLS_CERT_DIR` con `fullchain.pem` y `privkey.pem` y redirigía todo HTTP a HTTPS, lo que bloquea el desafío ACME inicial. Corregido: el proxy arranca en HTTP, sirve `/.well-known/acme-challenge/` y activa TLS cuando existe el certificado.

## Correcciones realizadas

- `backend/prisma/seed.js` dejó de aplicar SQL externo. `docker-entrypoint.sh` ejecuta `prisma migrate deploy` y después un seed idempotente.
- El backend Docker se construyó y arrancó: migraciones, seed y `/api/salud`. Sobre una base vacía aplicó las dos migraciones, sembró 5 roles y 0 usuarios de demostración (`SEED_DEMO_USERS=false`). Sobre la base local existente conservó 5 usuarios al reiniciar.
- Al salir con cola pendiente, SIGOT pide confirmación y no borra esa base. Al entrar otro usuario solo abre `sigot-u-<su-id>`. Si la cola está vacía, la base local de ese usuario sí se elimina.
- `deploy/nginx-bootstrap.conf`, `deploy/nginx-edge.conf`, `deploy/nginx-select-config.sh` y `deploy/init-letsencrypt.sh` cubren emisión inicial y renovación. `certbot` queda en el Compose de producción.
- `.github/workflows/sigot.yml` instala, prueba, compila y construye imágenes. Publicar a Docker Hub exige `workflow_dispatch` y secretos. Desplegar exige además `SIGOT_DEPLOY_ENABLED=true` y permanece con salida de error a propósito.

## Riesgos pendientes

- IndexedDB no está cifrada. El aislamiento es por nombre de base y por el código de la aplicación. DevTools en el mismo origen puede enumerar bases `sigot-u-*`.
- `npm audit` del backend reporta 4 avisos high: `deepmerge-ts` (transitivo de Prisma 6, GHSA-ggr8-5vv4-36mx) y `zod` 3 (GHSA-mrhx-c7xc-m3w5). `npm audit fix --force` instalaría Prisma 7 y Zod 4, incompatibles con este código. Prisma se usa como CLI y cliente, no para fusionar objetos de petición. Zod valida cuerpos con esquemas acotados; el aviso aplica a colecciones enormes. No se actualizaron.
- `npm audit` del frontend en dependencias de desarrollo reporta `glob`/`minimatch` (workbox-build / vite-plugin-pwa) y `deepmerge` (rollup). Con `--omit=dev` el frontend queda en 0 avisos. Esas librerías no se sirven al navegador.
- El Compose local sigue publicando PostgreSQL en el puerto 5432 y usa cookies no seguras porque el entorno es HTTP. No debe usarse así en un servidor público.
- La producción no se ensayó con un certificado real ni con DNS público.
- El técnico completa la primera plantilla activa. Si más adelante hay varias, la pantalla no elige por tipo de activo.

## Pruebas manuales pendientes

- Instalar SIGOT en el teléfono del técnico y abrirla en modo `standalone`.
- Escanear un QR impreso con la cámara trasera.
- Cortar la red del teléfono, registrar diagnóstico, solución, checklist, repuesto, foto y cierre, y comprobar al reconectar que no se duplican y que el cierre llega al final.
- Entrar con dos técnicos distintos en el mismo teléfono y confirmar que el segundo no ve la cola del primero.
- Generar una orden desde un mantenimiento preventivo y registrar una cuadrilla desde la pantalla.
- Emitir un certificado de Let's Encrypt en un droplet de DigitalOcean (primero con `--staging`).

## Preparación para producción

La aplicación queda preparada para un despliegue posterior, no desplegada.

Listo: código de sincronización y conservación de pendientes, pruebas de API y de interfaz en verde, migraciones al día, PostgreSQL y stack local healthy, imágenes locales construidas, Compose de producción con ACME, pipeline SIGOT escrito, secretos fuera del repositorio y usuarios de demostración apagados en producción.

No listo para declararla en producción: faltan certificados reales, un ensayo del Compose de producción, secretos de Docker Hub y DigitalOcean, y las pruebas en un teléfono. No se publicó nada en DigitalOcean.
