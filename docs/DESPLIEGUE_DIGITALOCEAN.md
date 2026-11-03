# Despliegue de SIGOT en DigitalOcean

Procedimiento para un Droplet Ubuntu 24.04 LTS, un dominio y Docker Compose. No se ha ejecutado contra DigitalOcean. El backend rechaza la plantilla si se deja sin modificar.

No arranque `docker-compose.yml` en el servidor. Ese archivo publica `5432` y `4000`, siembra usuarios de demostración y deja `COOKIE_SECURE` en `false`.

## Qué queda en ejecución

| Servicio | Imagen | Puertos del Droplet | Puerto interno |
| --- | --- | --- | --- |
| `db` | `postgres:17` | ninguno | `5432` |
| `backend` | `sigot-backend:local`, o la que indique `SIGOT_IMAGE_BACKEND` | ninguno | `4000` |
| `frontend` | `sigot-frontend:local`, o la que indique `SIGOT_IMAGE_FRONTEND` | ninguno | `80` |
| `proxy` | `sigot-proxy:local`, construida con `deploy/Dockerfile.proxy` desde `nginx:1.27-alpine` | `80` y `443` | `80` y, tras el certificado, `443` |
| `certbot` | `certbot/certbot:v2.11.0` | ninguno | ninguno |

El proyecto Compose se llama `sigot-prod`. Los volúmenes quedan así:

| Volumen | Uso |
| --- | --- |
| `sigot-prod_pgdata` | Datos de PostgreSQL en `/var/lib/postgresql/data` |
| `sigot-prod_uploads` | Evidencias en `/app/uploads` |
| `sigot-prod_certbot-www` | Desafío HTTP-01 en `/var/www/certbot` |
| `sigot-prod_letsencrypt` | Certificados en `/etc/letsencrypt` |
| `sigot-prod_proxy-certs` | Reservado y vacío. El primer arranque no lo usa |

`database/init/01-create-test-db.sql` no se monta en producción. Ese script crea la base local `sigot_test`. El esquema de producción lo aplican las migraciones `backend/prisma/migrations/20261101062213_init` y `backend/prisma/migrations/20261101063000_restricciones` con `prisma migrate deploy`.

## Droplet y DNS

Cree un Droplet Ubuntu 24.04 LTS con al menos 2 GB de RAM si va a construir las imágenes en el servidor. Anote la IPv4 pública. En el DNS del dominio cree un registro A hacia esa IPv4. Use un solo nombre, el mismo de `SIGOT_DOMAIN`.

Si el panel de DigitalOcean tiene un firewall, abra solo TCP `22`, `80` y `443`.

Esta copia de trabajo no es un repositorio Git y no tiene remoto. Cree el repositorio en GitHub, use la rama `main` y suba el código sin `.env`, `backend/.env`, `.env.production` ni `.seed-credentials`. En el Droplet sustituya `URL_DEL_REPOSITORIO` por la URL real.

## Instalación del sistema

Entre por SSH como `root`.

```bash
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
tee /etc/apt/sources.list.d/docker.list > /dev/null <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker compose version
```

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

```bash
git clone URL_DEL_REPOSITORIO /opt/sigot
cd /opt/sigot
```

No copie al servidor el `.env` de desarrollo ni `.seed-credentials`.

## Variables

Genere los secretos en el Droplet y no los pegue en el repositorio. `POSTGRES_PASSWORD` y `JWT_ACCESS_SECRET` salen de `openssl`. La contraseña del administrador debe tener al menos 10 caracteres, una minúscula, una mayúscula, un número y un símbolo; el alfabeto de abajo cumple esa regla.

```bash
cd /opt/sigot
openssl rand -hex 24
openssl rand -hex 32
python3 - <<'PY'
import secrets
import string
alfabeto = string.ascii_letters + string.digits + "*-_."
while True:
    clave = "".join(secrets.choice(alfabeto) for _ in range(24))
    if (any(c.islower() for c in clave) and any(c.isupper() for c in clave)
            and any(c.isdigit() for c in clave) and any(c in "*-_." for c in clave)):
        print(clave)
        break
PY
```

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Edite el archivo en el Droplet. Sustituya todos los valores de ejemplo:

- `POSTGRES_PASSWORD`: la primera salida, 48 caracteres hexadecimales.
- `JWT_ACCESS_SECRET`: la segunda salida, 64 caracteres hexadecimales.
- `ADMIN_INICIAL_PASSWORD`: la salida de Python.
- `ADMIN_INICIAL_CORREO`: un correo real del administrador.
- `SIGOT_DOMAIN`: el dominio, sin `https://` y sin barra.
- `APP_URL`: `https://` seguido exactamente de `SIGOT_DOMAIN`.
- `LETSENCRYPT_EMAIL`: un correo que Let's Encrypt pueda usar.
- Deje `LETSENCRYPT_STAGING=1` para la primera emisión.
- Deje `SEED_DEMO_USERS=false`. El Compose de producción además fija ese valor y no crea `admin@sigot.local`, `operador@sigot.local`, `supervisor@sigot.local`, `tecnico@sigot.local` ni `bodega@sigot.local`.
- Deje comentadas `SIGOT_IMAGE_BACKEND` y `SIGOT_IMAGE_FRONTEND` para construir en el Droplet.

Los valores van sin comillas, sin espacios y sin `$`. El backend no arranca si conserva `cambie-esta-clave`, `cambie-este-secreto-por-uno-aleatorio-de-64-caracteres`, `Cambie-Esta-Clave1`, `admin@ejemplo.com` o `https://sigot.ejemplo.com`.

Compruebe el DNS antes de emitir el certificado. La dirección debe ser la IPv4 del Droplet.

```bash
getent ahostsv4 "$(awk -F= '$1=="SIGOT_DOMAIN"{print $2}' .env.production)"
```

## Primer arranque

El primer arranque no usa certificados. `deploy/nginx-select-config.sh` copia `deploy/nginx-bootstrap.conf`, que solo escucha en el puerto `80`. El volumen de Let's Encrypt nace vacío. El puerto `443` queda publicado, pero Nginx no abre TLS hasta que el certificado existe.

```bash
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Si el build del frontend termina con `Killed`, el Droplet se quedó sin memoria. Añada intercambio y vuelva a construir:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

El backend aplica las migraciones y, si no hay usuarios, crea un administrador con `debeCambiarClave` en verdadero. Los reinicios posteriores no cambian esa contraseña.

Mientras no haya certificado, las cookies `Secure` no se guardan en el navegador. El inicio de sesión funciona después de HTTPS.

Compruebe que PostgreSQL no publicó puerto y que la API responde a través del proxy:

```bash
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml port db 5432 || true
docker compose --env-file .env.production -f docker-compose.prod.yml port backend 4000 || true
curl -fsS http://127.0.0.1/salud-proxy
curl -fsS http://127.0.0.1/salud
curl -fsS http://127.0.0.1/api/salud
```

`port` debe informar que `5432` y `4000` no están publicados. `/api/salud` debe responder JSON con `"estado":"ok"`. Si el backend reinicia, revise el registro:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail 80 backend
```

## Certificado

Con el DNS apuntando al Droplet y los puertos `80` y `443` abiertos:

```bash
cd /opt/sigot
sh deploy/init-letsencrypt.sh
```

Ese script lee `.env.production`, levanta el proxy, pide el certificado con el webroot `/var/www/certbot` y recrea el proxy. Con `LETSENCRYPT_STAGING=1` el certificado es de prueba y el navegador no confía en él.

Para el certificado real:

```bash
cd /opt/sigot
nano .env.production
```

Ponga `LETSENCRYPT_STAGING=0`. Después borre el certificado de prueba y emita otra vez. Sustituya el dominio por el valor real de `SIGOT_DOMAIN`:

```bash
cd /opt/sigot
DOMINIO=$(awk -F= '$1=="SIGOT_DOMAIN"{print $2}' .env.production)
docker compose --env-file .env.production -f docker-compose.prod.yml run -T --rm --no-deps --entrypoint certbot certbot delete --cert-name "$DOMINIO" --non-interactive
sh deploy/init-letsencrypt.sh
```

La renovación no es un cron del sistema. El servicio `certbot` ejecuta `certbot renew --webroot -w /var/www/certbot` cada 12 horas. El proxy ejecuta `nginx -s reload` cada 21600 segundos y vuelve a leer el certificado.

Compruebe HTTPS:

```bash
cd /opt/sigot
DOMINIO=$(awk -F= '$1=="SIGOT_DOMAIN"{print $2}' .env.production)
curl -fsS "https://${DOMINIO}/api/salud"
```

Abra `https://DOMINIO/login`. Entre con `ADMIN_INICIAL_CORREO` y `ADMIN_INICIAL_PASSWORD`. SIGOT redirige a `/cambiar-clave`. La contraseña nueva también debe cumplir la política de 10 caracteres.

El valor de `ADMIN_INICIAL_PASSWORD` solo se usa cuando la tabla de usuarios está vacía. Después del cambio puede sustituirlo por otra contraseña válida, guardar el archivo con `chmod 600` y recrear el backend. SIGOT no vuelve a modificar al administrador:

```bash
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate backend
```

## Cómo llega el navegador a la API

`frontend/Dockerfile` fija `VITE_API_URL=/api` durante `npm run build`. `frontend/src/services/api.js` usa esa variable y, si no existe, `/api`. El Nginx del frontend, `frontend/nginx.conf`, reenvía `location /api/` a `http://backend:4000`. El proxy público reenvía el sitio a `http://frontend:80`.

Las cookies de producción salen con `COOKIE_SECURE=true`:

- `sigot_access`: HttpOnly, Secure, SameSite `lax`, ruta `/`
- `sigot_refresh`: HttpOnly, Secure, SameSite `strict`, ruta `/api/auth`

`MAX_UPLOAD_MB` vale 8 por defecto. Nginx acepta hasta `10m` en `frontend/nginx.conf`, `deploy/nginx-bootstrap.conf` y `deploy/nginx-edge.conf`. Si sube `MAX_UPLOAD_MB` por encima de 8, aumente `client_max_body_size` en esos tres archivos.

## Salud

| Servicio | Comprobación |
| --- | --- |
| `db` | `pg_isready -U` el usuario y `-d` la base definidos en `.env.production` |
| `backend` | `http://127.0.0.1:4000/api/salud` |
| `frontend` | `http://127.0.0.1/salud` |
| `proxy` | `http://127.0.0.1/salud-proxy` |

## Copia de seguridad

```bash
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "sigot-$(date +%F).sql"
docker run --rm -v sigot-prod_uploads:/datos:ro -v "$PWD":/salida postgres:17 \
  tar -C /datos -czf "/salida/sigot-evidencias-$(date +%F).tar.gz" .
```

Esos archivos contienen datos personales. Sáquelos del Droplet y no los suba al repositorio.

## Actualizar la aplicación

```bash
cd /opt/sigot
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Para volver a un commit anterior: `git checkout` de ese commit y el mismo `up -d --build`. Las migraciones de Prisma no se revierten solas.

## Imágenes publicadas

El Droplet no las necesita. Si más adelante usa Docker Hub, en `.env.production` ponga el usuario del secreto `DOCKERHUB_USERNAME` y el SHA que etiquetó el workflow:

```text
SIGOT_IMAGE_BACKEND=USUARIO/sigot-backend:SHA
SIGOT_IMAGE_FRONTEND=USUARIO/sigot-frontend:SHA
```

Después:

```bash
cd /opt/sigot
docker compose --env-file .env.production -f docker-compose.prod.yml pull backend frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build
```

El proxy se sigue construyendo en el Droplet como `sigot-proxy:local`. El workflow no lo publica.

## GitHub Actions

El archivo es `.github/workflows/sigot.yml`. En cada push o pull request a `main` o `master`:

1. Instala el backend y el frontend con Node.js 22.
2. Ejecuta `npm test` del backend, `npm run build` y `npm test` del frontend, y `npm run test:e2e`.
3. Construye, sin publicarlas, `sigot-backend:<sha>`, `sigot-frontend:<sha>` y `sigot-proxy:<sha>`.
4. Valida `docker-compose.prod.yml` y la sintaxis de Nginx.

La ejecución manual tiene dos entradas, ambas en falso por defecto:

- `publicar_imagenes`: exige los secretos `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN`. Publica `USUARIO/sigot-backend` y `USUARIO/sigot-frontend` con el SHA del commit y el nombre de la rama. No publica el proxy.
- `desplegar`: solo se evalúa si también se publicó y si la variable del repositorio `SIGOT_DEPLOY_ENABLED` vale `true`. Aun así el job no abre SSH, no copia archivos y termina con error. Los secretos previstos, todavía sin uso, son `DIGITALOCEAN_HOST`, `DIGITALOCEAN_USER` y `DIGITALOCEAN_SSH_KEY`.

No ponga `SIGOT_DEPLOY_ENABLED=true` hasta autorizar el despliegue. No guarde el token de Docker Hub ni la clave SSH en el repositorio.

## Pruebas antes de subir el código

En una máquina de desarrollo, con la base local de `docker-compose.yml` (no la de producción):

```bash
cd backend
npm test
cd ../frontend
npm run build
npm test
npm run test:e2e
```

`npm test` del backend usa `sigot_test`. No sustituye la base `sigot` ni la base del Droplet.

## Pendiente antes de llamar a esto producción

- Crear el Droplet, el DNS y el repositorio Git. Esta carpeta todavía no es un repositorio y no tiene remoto.
- Sustituir la plantilla y emitir el certificado real con `LETSENCRYPT_STAGING=0`.
- Entrar en `/login` y cambiar la contraseña inicial.
- Dejar `SIGOT_DEPLOY_ENABLED` sin el valor `true`. El job `desplegar` no despliega.
- No hay ensayo de este Compose contra un Droplet en esta preparación.
