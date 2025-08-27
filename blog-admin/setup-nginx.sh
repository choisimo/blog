#!/usr/bin/env sh
set -eu

if [ -f /etc/nginx/nginx.conf.template ]; then
  envsubst '\$ADMIN_FRONTEND_UPSTREAM_HOSTPORT\$ADMIN_BACKEND_UPSTREAM_HOSTPORT\$ADMIN_SERVER_NAME' \
    < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
fi

exec nginx -g 'daemon off;'