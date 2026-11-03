#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  if ! command -v gosu >/dev/null 2>&1; then
    echo "SIGOT: la imagen del backend no incluye gosu"
    exit 1
  fi
  mkdir -p /app/uploads
  chown node:node /app/uploads
  exec gosu node "$0" "$@"
fi

if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
  DATABASE_URL=$(node scripts/database-url.mjs)
  export DATABASE_URL
fi

if [ "${COOKIE_SECURE:-}" = "true" ]; then
  if [ "${SEED_DEMO_USERS:-}" = "true" ]; then
    echo "SIGOT: SEED_DEMO_USERS no puede estar activo con cookies seguras"
    exit 1
  fi
  case "${JWT_ACCESS_SECRET:-}" in
    ""|cambie-este-secreto-por-uno-aleatorio-de-64-caracteres)
      echo "SIGOT: reemplace JWT_ACCESS_SECRET en .env.production"
      exit 1
      ;;
  esac
  case "${POSTGRES_PASSWORD:-}" in
    ""|cambie-esta-clave)
      echo "SIGOT: reemplace POSTGRES_PASSWORD en .env.production"
      exit 1
      ;;
  esac
  case "${ADMIN_INICIAL_PASSWORD:-}" in
    ""|Cambie-Esta-Clave1|cambie-esta-clave)
      echo "SIGOT: reemplace ADMIN_INICIAL_PASSWORD en .env.production"
      exit 1
      ;;
  esac
  case "${APP_URL:-}" in
    https://*) ;;
    *)
      echo "SIGOT: APP_URL debe empezar por https://"
      exit 1
      ;;
  esac
  host="${APP_URL#https://}"
  if [ -z "${SIGOT_DOMAIN:-}" ] || [ "$host" != "$SIGOT_DOMAIN" ]; then
    echo "SIGOT: APP_URL debe ser exactamente https://${SIGOT_DOMAIN}"
    exit 1
  fi
  correo=$(printf '%s' "${ADMIN_INICIAL_CORREO:-}" | tr '[:upper:]' '[:lower:]')
  if [ "$correo" = "admin@ejemplo.com" ] || [ -z "$correo" ]; then
    echo "SIGOT: reemplace ADMIN_INICIAL_CORREO en .env.production"
    exit 1
  fi
fi

echo "SIGOT: aplicando migraciones"
./node_modules/.bin/prisma migrate deploy

echo "SIGOT: sembrando datos iniciales (idempotente)"
node prisma/seed.js

echo "SIGOT: iniciando API"
exec node src/server.js
