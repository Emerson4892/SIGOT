# SIGOT

Sistema Integral de Gestión de Operaciones Técnicas. Proyecto C — Centro de Operaciones de Campo, Activos e Incidentes, Universidad Mariano Gálvez de Guatemala.

La aplicación corre en local. La configuración de producción está preparada en `docker-compose.prod.yml` y no se ha desplegado.

## Qué incluye

- API REST en Node.js, Express y Prisma, con PostgreSQL 17.
- Panel web para administrador, operador, supervisor y bodega.
- PWA instalable para el técnico, con cola offline en IndexedDB.
- Sesiones en cookies HttpOnly, contraseñas Argon2id y permisos comprobados en el servidor.
- QR de activos, tokens de cierre crítico, evidencias, inventario transaccional y auditoría encadenada.

## Requisitos locales

- Node.js 22 o superior
- Docker con Docker Compose
- npm

## Puesta en marcha

Desde la raíz del proyecto:

```bash
node scripts/init-env.mjs
docker compose up -d db
```

`scripts/init-env.mjs` crea `.env`, `backend/.env` y `.seed-credentials` si no existen. Esas contraseñas no se suben al repositorio.

Backend:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

`prisma migrate deploy` aplica el esquema y las restricciones de inventario y auditoría. El seed solo carga catálogos y, si está activo, usuarios de demostración. Es idempotente: puede repetirse al reiniciar el contenedor.

Frontend, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. La API queda en `http://localhost:4000` y Vite reenvía `/api`.

Para levantar base, API y frontend juntos:

```bash
docker compose up --build
```

El panel publicado por Compose queda en `http://localhost:8080`.

## Usuarios de demostración

| Correo | Rol |
| --- | --- |
| admin@sigot.local | Administrador |
| operador@sigot.local | Operador |
| supervisor@sigot.local | Supervisor |
| tecnico@sigot.local | Técnico |
| bodega@sigot.local | Bodega |

La contraseña de cada uno está en `.seed-credentials`. El primer acceso de un usuario creado desde el panel exige cambiar la contraseña. Los cinco usuarios de demostración ya pueden entrar.

La cola offline del técnico guarda diagnóstico, solución, checklist, repuestos, evidencias y la solicitud de cierre. Al recuperar la conexión las envía en ese orden. El cierre no sale hasta que el servidor confirma los pasos previos y las evidencias. Cada operación conserva su identificador y se reintenta si la red falla.

Si el técnico cierra sesión con operaciones pendientes, SIGOT avisa y conserva esa cola en IndexedDB, aislada por usuario. Otro técnico en el mismo navegador no ve esas operaciones. La base local se elimina solo cuando la cola de ese usuario queda vacía.

## Pruebas

```bash
cd backend
npm test
```

```bash
cd frontend
npm run build
npm test
npm run test:e2e
```

Las pruebas del backend usan la base `sigot_test`, aplican migraciones, siembran datos y recorren el flujo completo de una orden. Playwright vuelve a preparar esa misma base y recorre el flujo desde la interfaz. No sustituyen la base de desarrollo `sigot`.

## Producción

El procedimiento del Droplet está en `docs/DESPLIEGUE_DIGITALOCEAN.md`.

`docker-compose.prod.yml` no publica PostgreSQL ni el puerto 4000. El proxy escucha 80 y 443. Sin certificado arranca en HTTP y no carga archivos TLS inexistentes. `COOKIE_SECURE` queda en `true` y `SEED_DEMO_USERS` queda en `false`. El primer administrador se crea solo si no hay usuarios, con `ADMIN_INICIAL_CORREO` y `ADMIN_INICIAL_PASSWORD`.

No use `docker-compose.yml` en el servidor. Ese archivo publica el puerto 5432 y siembra los usuarios de demostración.

## CI

`.github/workflows/sigot.yml` instala dependencias, ejecuta pruebas, compila el frontend y construye `sigot-backend`, `sigot-frontend` y `sigot-proxy` con la etiqueta del commit. Publicar en Docker Hub exige `workflow_dispatch` con `publicar_imagenes`. El job de DigitalOcean no abre SSH y termina con error hasta autorizar el despliegue.

## Documentación

- `docs/DESPLIEGUE_DIGITALOCEAN.md`
- `docs/PLAN_DESARROLLO.md`
- `docs/MATRIZ_REQUISITOS.md`
- `docs/INFORME_AUDITORIA.md`
- `docs/openapi.yaml`

## Estructura

```text
backend/     API, Prisma, migraciones y pruebas
frontend/    React, PWA, pruebas de la cola y Playwright
database/    scripts de inicio y referencia SQL de restricciones
deploy/      proxy HTTP/HTTPS, ACME y emisión de certificados
docs/        plan, matriz, informe y OpenAPI
.github/     pipeline SIGOT
```
