# Plan de desarrollo SIGOT

SIGOT es el Sistema Integral de Gestión de Operaciones Técnicas del Proyecto C. El trabajo se limita al entorno local. El despliegue en DigitalOcean queda fuera de esta ejecución.

## Fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| 1 | Estructura, API Express, React/Vite y conexión a PostgreSQL | Implementado |
| 2 | Modelo Prisma, migraciones, restricciones e inicialización | Verificado: las restricciones corren en `migrate deploy`, no en el seed |
| 3 | Autenticación, usuarios, roles y permisos | Verificado en API |
| 4 | Clientes, ubicaciones, tipos de activo y activos con QR | Verificado en API |
| 5 | Incidentes, órdenes, prioridades y SLA | Verificado en API |
| 6 | Técnicos, cuadrillas y asignaciones | Verificado en API |
| 7 | Inventario y movimientos | Verificado en API |
| 8 | Checklists, evidencias y archivos | Verificado en API |
| 9 | Mantenimientos preventivos e historial de activos | Verificado en API |
| 10 | Aprobaciones, tokens temporales y validación QR | Verificado en API |
| 11 | Tablero, reportes y auditoría | Verificado en API |
| 12 | PWA instalable, IndexedDB y cola de sincronización | Verificado |
| 13 | Pruebas de API contra PostgreSQL y pruebas de la cola PWA | Verificado en API |
| 14 | Docker local, OpenAPI y esta documentación | Verificado: Compose local arrancó completo |
| 15 | Orden de sincronización, aislamiento de la PWA y configuración de producción | Verificado en local; sin despliegue |
| 16 | Arranque Docker sin `restricciones.sql`, cola offline al salir, HTTPS/ACME, GitHub Actions | Verificado en local; publicación y DigitalOcean pendientes |

La interfaz React consume la misma API. El recorrido automatizado queda en `docs/MATRIZ_REQUISITOS.md` y el detalle de esta revisión en `docs/INFORME_AUDITORIA.md`.

## Decisiones

- Un monolito modular: React habla con Express por HTTP y PostgreSQL es la única base de negocio.
- Sesión web con cookies HttpOnly. El token CSRF vive en memoria del navegador.
- El técnico solo ve órdenes asignadas. El servidor responde 404 si la orden no le corresponde.
- El consumo de repuestos descuenta stock dentro de una transacción y rechaza existencias negativas.
- La auditoría forma una cadena de hashes. Un trigger impide actualizar o borrar filas. Ese trigger y los CHECK de inventario se aplican una sola vez por migración Prisma.
- Las operaciones de campo que pueden esperar (diagnóstico, solución, checklist, repuestos, evidencia y solicitud de cierre) se encolan en IndexedDB, en ese orden. El cierre espera la confirmación de los pasos anteriores. Aceptar, validar QR, iniciar y aprobar exigen conexión.
- La cola y las órdenes guardadas viven en una base IndexedDB por técnico. Cerrar sesión con pendientes las conserva en ese dispositivo, sin exponerlas a otro usuario. La base se borra cuando la cola de ese usuario queda vacía.
- El Service Worker precachea la aplicación y no guarda respuestas de `/api`.
- `docker-compose.yml` es el entorno local. `docker-compose.prod.yml` arranca el proxy en HTTP hasta emitir el certificado de Let's Encrypt y no se despliega en esta fase.
- Las contraseñas de demostración se generan en `.env` y `.seed-credentials`, ambos ignorados por git. En producción quedan desactivadas salvo que se encienda `SEED_DEMO_USERS`.
- El pipeline `.github/workflows/sigot.yml` prueba y construye. Publicar imágenes y desplegar exige autorización explícita y secretos.
