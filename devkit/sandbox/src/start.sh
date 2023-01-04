#!/bin/bash

# prevent sourcing of this script, only allow execution
$(return >/dev/null 2>&1)
test "$?" -eq "0" && { echo "This script should only be executed." >&2; exit 1; }

# set working dir to this file's dir
cd "$(dirname ${BASH_SOURCE[0]})"

# load sandbox's start & stop functions
source ./common.sh

# If there's a fatal error
trap 'stop' SIGINT SIGKILL SIGTERM ERR

# start sandbox
start

docker ps