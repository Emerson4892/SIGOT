#!/bin/sh
set -eu

HTTPS_CONF=/etc/nginx/sigot/https.conf
HTTP_CONF=/etc/nginx/sigot/http.conf
TARGET=/etc/nginx/conf.d/default.conf
ACTIVE_DIR=/tmp/sigot-certs

mkdir -p "$ACTIVE_DIR" /var/www/certbot

DOMINIO="${SIGOT_DOMAIN:-_}"
if ! printf '%s' "$DOMINIO" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^_$'; then
  echo "SIGOT proxy: SIGOT_DOMAIN no es un nombre de dominio valido"
  exit 1
fi

publicar() {
  cp "$1" "$TARGET"
  sed -i "s|server_name _;|server_name ${DOMINIO};|g" "$TARGET"
}

activar_tls() {
  ln -sfn "$1" "$ACTIVE_DIR/fullchain.pem"
  ln -sfn "$2" "$ACTIVE_DIR/privkey.pem"
  publicar "$HTTPS_CONF"
  echo "SIGOT proxy: TLS activo para ${DOMINIO}"
}

if [ -f /etc/nginx/certs/fullchain.pem ] && [ -f /etc/nginx/certs/privkey.pem ]; then
  activar_tls /etc/nginx/certs/fullchain.pem /etc/nginx/certs/privkey.pem
elif [ "$DOMINIO" != "_" ] \
  && [ -f "/etc/letsencrypt/live/${DOMINIO}/fullchain.pem" ] \
  && [ -f "/etc/letsencrypt/live/${DOMINIO}/privkey.pem" ]; then
  activar_tls \
    "/etc/letsencrypt/live/${DOMINIO}/fullchain.pem" \
    "/etc/letsencrypt/live/${DOMINIO}/privkey.pem"
else
  publicar "$HTTP_CONF"
  echo "SIGOT proxy: HTTP de arranque. No hay certificado; ejecute sh deploy/init-letsencrypt.sh"
fi
