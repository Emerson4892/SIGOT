#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

ENV_FILE="${SIGOT_ENV_FILE:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta ${ENV_FILE}. Copie .env.production.example y complete los valores en el servidor."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "No está instalado el plugin docker compose."
  exit 1
fi

leer_variable() {
  awk -F= -v clave="$1" '
    $0 ~ /^[[:space:]]*#/ { next }
    $1 == clave {
      sub(/^[^=]*=/, "")
      sub(/\r$/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

SIGOT_DOMAIN=$(leer_variable SIGOT_DOMAIN)
LETSENCRYPT_EMAIL=$(leer_variable LETSENCRYPT_EMAIL)
LETSENCRYPT_STAGING=$(leer_variable LETSENCRYPT_STAGING)

if [ -z "$SIGOT_DOMAIN" ] || [ "$SIGOT_DOMAIN" = "sigot.ejemplo.com" ]; then
  echo "Reemplace SIGOT_DOMAIN en ${ENV_FILE}. No use sigot.ejemplo.com."
  exit 1
fi
case "$SIGOT_DOMAIN" in
  *[!A-Za-z0-9.-]*|.*|*-|*.) echo "SIGOT_DOMAIN no es un nombre de dominio válido."; exit 1 ;;
esac
correo=$(printf '%s' "$LETSENCRYPT_EMAIL" | tr '[:upper:]' '[:lower:]')
if [ -z "$correo" ] || [ "$correo" = "admin@ejemplo.com" ]; then
  echo "Reemplace LETSENCRYPT_EMAIL en ${ENV_FILE}. No use admin@ejemplo.com."
  exit 1
fi

compose() {
  env -i \
    PATH="$PATH" \
    HOME="${HOME:-/root}" \
    USER="${USER:-root}" \
    ${DOCKER_HOST:+DOCKER_HOST=$DOCKER_HOST} \
    SIGOT_DOMAIN="$SIGOT_DOMAIN" \
    docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

STAGING=""
if [ "$LETSENCRYPT_STAGING" = "1" ] || [ "$LETSENCRYPT_STAGING" = "true" ]; then
  STAGING="--staging"
  echo "Usando el entorno de pruebas de Let's Encrypt. El navegador no confiará en este certificado."
fi

echo "Levantando la pila hasta que el proxy responda..."
compose up -d --wait --wait-timeout 300 proxy

echo "Deteniendo la renovación mientras se emite el certificado..."
compose stop certbot

linea=$(compose run -T --rm --no-deps --entrypoint sh certbot -c "grep -h '^server' /etc/letsencrypt/renewal/${SIGOT_DOMAIN}.conf 2>/dev/null || true")
existente=ninguno
if printf '%s' "$linea" | grep -q 'acme-staging'; then
  existente=staging
elif printf '%s' "$linea" | grep -q 'acme-v02'; then
  existente=real
fi

if [ "$existente" = "staging" ] && [ -z "$STAGING" ]; then
  echo "El certificado actual es de pruebas. Elimínelo y vuelva a ejecutar sh deploy/init-letsencrypt.sh:"
  echo "docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml run --rm --no-deps --entrypoint certbot certbot delete --cert-name ${SIGOT_DOMAIN} --non-interactive"
  exit 1
fi

if [ "$existente" = "real" ] && [ -n "$STAGING" ]; then
  echo "Ya hay un certificado real. No se sustituye por uno de prueba."
  compose up -d --force-recreate --wait --wait-timeout 300 proxy
  compose up -d certbot
  exit 0
fi

echo "Solicitando el certificado de ${SIGOT_DOMAIN}..."
# shellcheck disable=SC2086
compose run -T --rm --no-deps --entrypoint certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$SIGOT_DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --keep-until-expiring \
  $STAGING

echo "Activando TLS y la renovación..."
compose up -d --force-recreate --wait --wait-timeout 300 proxy
compose up -d certbot

echo "Certificado emitido para ${SIGOT_DOMAIN}."
echo "certbot renew se ejecuta cada 12 horas. El proxy recarga Nginx cada 6 horas y toma el certificado renovado."
if [ -n "$STAGING" ]; then
  echo "Este certificado es de prueba. Para el certificado que el navegador acepta:"
  echo "  1. Ponga LETSENCRYPT_STAGING=0 en ${ENV_FILE}"
  echo "  2. docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml run --rm --no-deps --entrypoint certbot certbot delete --cert-name ${SIGOT_DOMAIN} --non-interactive"
  echo "  3. sh deploy/init-letsencrypt.sh"
fi
