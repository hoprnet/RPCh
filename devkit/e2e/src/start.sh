#!/bin/bash

# prevent sourcing of this script, only allow execution
$(return >/dev/null 2>&1)
test "$?" -eq "0" && { echo "This script should only be executed." >&2; exit 1; }

# set working dir to this file's dir
cd "$(dirname ${BASH_SOURCE[0]})"

# load sandbox's start & stop functions
source ../../sandbox/src/common.sh

# If there's a fatal error or users Ctrl+C it will tear down setup
trap 'stop' SIGINT SIGKILL SIGTERM ERR EXIT

# start sandbox
start

# Extract entry and exit node peer ids from pluto logs
entry_node_peer_id=$(cat logs | grep "node1" -A 1 | grep "Peer Id" | awk '{ print $5 }')
exit_node_peer_id=$(cat logs | grep "node5" -A 1 | grep "Peer Id" | awk '{ print $5 }')
exit_node_pub_key=$(echo "$logs5" | grep "Running exit node with public key" | awk '{print $9}')

echo "Found entry node peer id"
echo $entry_node_peer_id
echo "Found exit node peer id"
echo $exit_node_peer_id
echo "Found exit node public key"
echo $exit_node_pub_key

# catch error if command fails
set -Eeuo
# Run tests with env variables
ENTRY_NODE_PEER_ID="$entry_node_peer_id" EXIT_NODE_PEER_ID="$exit_node_peer_id" ENTRY_NODE_API_TOKEN="$HOPRD_API_TOKEN" \
    EXIT_NODE_PUB_KEY="$exit_node_pub_key" npx jest --ci
# stop catching
set +Eeuo

# After tests exit tear down setup
stop