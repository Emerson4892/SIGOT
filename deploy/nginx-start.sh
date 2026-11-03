#!/bin/sh
set -eu

tr -d '\r' < /etc/nginx/sigot/select-config.sh > /tmp/sigot-select-config.sh
chmod +x /tmp/sigot-select-config.sh
sh /tmp/sigot-select-config.sh

(
  while :; do
    sleep 21600
    sh /tmp/sigot-select-config.sh || true
    nginx -s reload || true
  done
) &

exec nginx -g "daemon off;"
