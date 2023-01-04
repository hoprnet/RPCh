#!/bin/bash

# prevent sourcing of this script, only allow execution
$(return >/dev/null 2>&1)
test "$?" -eq "0" && { echo "This script should only be executed." >&2; exit 1; }

# set working dir to this file's dir
cd "$(dirname "$0")"

source ./common.sh
start

docker ps