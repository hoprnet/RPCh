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

set +u

### Store container env vars for rpc-server
touch /docker.env
env_vars=$(cat /env_vars.def)
while read -r key; do
    if [[ -n "${!key}" ]]; then
        echo "${key}=${!key}" >> /docker.env
    fi
done <<< "$env_vars"

set -u

### Store container env vars for rpc-server
cat <<EOF > /haproxy.env
PORT=${PORT:-45752}
FRONTEND_HTTP_PORT=${FRONTEND_HTTP_PORT:-45750}
FRONTEND_HTTPS_PORT=${FRONTEND_HTTPS_PORT:-45751}
EOF

### Execute script with arguments
exec "${@}"
