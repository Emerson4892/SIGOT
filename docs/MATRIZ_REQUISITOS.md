# Matriz de requisitos — Proyecto C / SIGOT

Estados: Pendiente, En desarrollo, Implementado, Verificado, Bloqueado.

Verificado significa que la prueba correspondiente se ejecutó contra PostgreSQL o, en la interfaz, que el flujo se recorrió en el navegador. La interfaz no se marca verificada solo por existir el código.

## Plataforma

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| API REST modular con Express, Prisma y PostgreSQL 17 | Verificado | `backend/tests/sistema.test.js` |
| React, Vite, React Router, Bootstrap 5, Axios y React Hook Form | Verificado | inicio de sesión, tablero, alta de cliente y menú por rol en Playwright |
| Autenticación Argon2id, JWT de acceso, refresh revocable y cookies HttpOnly | Verificado | prueba de sesión, CSRF y usuario desactivado |
| Recuperación de contraseña sin revelar si el correo existe | Verificado | prueba de restablecimiento en la base de pruebas |
| Cambio de contraseña y revocación de sesiones | Implementado | API y pantalla de perfil |
| Cinco roles y permisos validados en el servidor | Verificado | operador recibe 403 al crear usuarios; técnico recibe 404 en orden ajena |
| Técnico no aprueba su propio cierre | Verificado | prueba del flujo operativo |
| Panel administrativo y PWA de técnicos sobre la misma API | Verificado | el administrador abre el modo campo; el operador no ve usuarios ni modo campo |
| Docker Compose local con PostgreSQL, backend y frontend | Verificado | `docker compose up --build`: db, backend y frontend healthy; API `/api/salud` 200; panel `http://localhost:8080` 200 |
| Restricciones SQL aplicadas por migraciones, seed idempotente | Verificado | migración `20261101063000_restricciones`; seed sin `restricciones.sql`; arranque en base nueva y reinicio sin duplicar |
| Configuración de producción sin exposición de PostgreSQL | Implementado | `docker-compose.prod.yml` valida su sintaxis. El proxy HTTP/ACME no exige certificados previos. No se inició el stack de producción |
| Pipeline GitHub Actions | Implementado | `.github/workflows/sigot.yml` instala, prueba, compila y construye imágenes. Publicación y despliegue deshabilitados |
| Despliegue en DigitalOcean | Pendiente | fuera de esta ejecución |

## Módulos

| Módulo | Estado | Evidencia |
| --- | --- | --- |
| 1. Usuarios, roles y permisos | Verificado | alta, desactivación y CSRF en `sistema.test.js` |
| 2. Clientes y ubicaciones | Verificado | flujo operativo crea cliente y ubicación |
| 3. Activos e infraestructura con QR | Verificado | PNG y contenido QR; secreto ausente en la respuesta |
| 4. Tipos de activo | Verificado | el flujo crea el tipo antes del activo |
| 5. Incidentes convertibles en orden | Verificado | convertir incidente devuelve la orden |
| 6. Órdenes y trazabilidad de estados | Verificado | historial y cierre rechazado sin evidencia |
| 7. Prioridades y SLA | Verificado | políticas iniciales y banderas de incumplimiento en el modelo |
| 8. Cuadrillas y técnicos | Implementado | el flujo usa el técnico de demostración. El alta de cuadrilla no se recorrió en esta ejecución |
| 9. Asignaciones, aceptación y rechazo | Verificado | asignación, aceptación y rechazo de QR |
| 10. Inventario de repuestos y alertas | Verificado | stock y alerta de bajo mínimo en el tablero |
| 11. Movimientos sin stock negativo | Verificado | salida excesiva responde 409; consumo idempotente |
| 12. Checklists | Verificado | completar plantilla obligatoria en el flujo |
| 13. Evidencias y archivos | Verificado | PNG con firma válida; descarga autenticada |
| 14. Mantenimientos preventivos | Implementado | API y pantalla presentes. Esta ejecución no generó una orden preventiva |
| 15. Historial de activos | Verificado | el flujo comprueba incidente, orden, diagnóstico, reparación, repuesto y evidencia |
| 16. Aprobaciones y tokens de cierre crítico | Verificado | aprobación normal y token obligatorio en prioridad crítica |
| 17. Tablero, reportes y exportación CSV | Verificado | resumen y CSV contienen datos reales de la orden |
| 18. Auditoría inmutable | Verificado | `GET /api/auditoria/verificar` responde cadena íntegra; trigger presente tras migrar |

## Reglas de negocio

| Regla | Estado |
| --- | --- |
| Trazabilidad de estados de la orden | Verificado |
| Cierre exige diagnóstico y evidencia mínima | Verificado |
| El consumo actualiza inventario en transacción | Verificado |
| SLA de órdenes críticas se registra al vencer o cerrar | Verificado |
| El supervisor aprueba o rechaza el cierre | Verificado |
| Historial técnico del activo | Verificado |
| El técnico solo interviene órdenes asignadas | Verificado |
| Inventario no negativo | Verificado |
| Idempotencia de operaciones repetidas | Verificado |
| Auditoría de operaciones sensibles | Verificado |

## PWA

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| Manifest standalone, iconos y service worker | Verificado | compilación y Chromium: el manifest pide `standalone` y el service worker queda registrado |
| El service worker no guarda respuestas de `/api` | Verificado | `dist/sw.js` solo precachea la aplicación y excluye `/api` de la navegación |
| Cola por técnico, deduplicación e identificadores | Verificado | `frontend/tests/pwa.test.js` |
| Orden de sincronización y cierre diferido | Verificado | prueba de API y prueba de la cola: la evidencia se confirma antes del cierre |
| Cerrar sesión con pendientes y cambio de usuario | Verificado | la cola se conserva; otro usuario ve «No hay operaciones pendientes»; el técnico original recupera el diagnóstico |
| Aviso al perder la conexión | Verificado | Playwright desconecta Chromium y muestra el aviso de campo |
| Instalación en el teléfono y cámara física | Pendiente de verificación manual | el botón de escaneo y el atributo `capture` se vieron en la prueba; no hay dispositivo físico |

## Flujo principal

La prueba de API recorre el flujo contra PostgreSQL. Playwright, sobre la base `sigot_test` y sin datos simulados, repitió en Chromium: inicio de sesión del administrador, cliente, ubicación, tipo, activo, QR, incidente, orden, asignación, aceptación, inicio con el contenido del QR, checklist, diagnóstico, solución, alta de repuesto, consumo, fotografía, solicitud de cierre, aprobación, stock resultante, historial y verificación de la cadena de auditoría.

No se pulsaron en esa pasada las pantallas de roles, cuadrillas, movimientos manuales, mantenimientos preventivos, SLA ni reportes. Su API sigue cubierta donde la prueba de integración ya las ejercita; la generación de una orden preventiva no formó parte de esta ejecución.
