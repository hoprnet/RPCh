#!/usr/bin/env bash
# shellcheck disable=SC1090

###
### Only root user can run this
###
if [ ! "$(id -u)" = "0" ]; then
    echo "Only root user can run this container"
    echo "To use a specific user define the USER variable"
    echo "For more information, visit https://github.com/docker-suite/alpine-runit"
    exit 1
fi

###
### Source libs in /etc/entrypoint.d
###
for file in $( find /etc/entrypoint.d/ -name '*.sh' -type f | sort -u ); do
    source "${file}"
done

###
### Source custom user supplied libs in /startup.d
###
source_scripts "/startup.d"

###
### Run custom user supplied scripts
###
execute_scripts "/startup.1.d"
execute_scripts "/startup.2.d"

### Run with the correct user
if [ -n "$USER" ]; then
    DEBUG "Running as user $USER"
    set -- su-exec "$USER" runit "$@"
else
    set -- runit "$@"
fi

### Store container env vars for rpc-server
cat <<EOF > /docker.env
CLIENT=${CLIENT}
DEBUG=${DEBUG:-}
DISCOVERY_PLATFORM_API_ENDPOINT=${DISCOVERY_PLATFORM_API_ENDPOINT:-}
RESPONSE_TIMEOUT=${RESPONSE_TIMEOUT:-}
PROVIDER=${PROVIDER:-}
DISABLE_MEV_PROTECTION=${DISABLE_MEV_PROTECTION:-}
MEV_PROTECTION_PROVIDER=${MEV_PROTECTION_PROVIDER:-}
MEV_KICKBACK_ADDRESS=${MEV_KICKBACK_ADDRESS:-}
FORCE_ZERO_HOP=${FORCE_ZERO_HOP:-}
SEGMENT_LIMIT=${SEGMENT_LIMIT:-}
RESTRICT_CORS=${RESTRICT_CORS:-}
SKIP_RPCH=${SKIP_RPCH:-}
PORT=${PORT:-}
EOF

### Store container env vars for rpc-server
cat <<EOF > /haproxy.env
PORT=${PORT:-}
FRONTEND_HTTP_PORT=${FRONTEND_HTTP_PORT:-45750}
FRONTEND_HTTPS_PORT=${FRONTEND_HTTPS_PORT:-45751}
EOF

### Execute script with arguments
exec "${@}"
