#!/bin/sh

# If there's a fatal error or users Ctrl+C it will tear down setup
trap 'docker compose down; rm ./logs; exit' SIGINT || trap 'docker compose down; rm ./logs; exit' SIGKILL

#  Run docker compose as daemon
docker compose up -d --remove-orphans --build --force-recreate

# Extract HOPRD_API_TOKEN from env file
source .env

logs1=""
logs2=""
logs3=""
logs4=""
logs5=""
logs_pluto=""
pluto=false
sleep 10

until [[ $logs1 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs devkit-exit-1-1 &> logs
    logs1=$(cat logs)
    sleep 1
done
echo "Node 1 running"

until [[ $logs2 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs devkit-exit-2-1 &> logs
    logs2=$(cat logs)
    sleep 1
done
echo "Node 2 running"

until [[ $logs3 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs devkit-exit-3-1 &> logs
    logs3=$(cat logs)
    sleep 1
done
echo "Node 3 running"

until [[ $logs4 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs devkit-exit-4-1 &> logs
    logs4=$(cat logs)
    sleep 1
done
echo "Node 4 running"

until [[ $logs5 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs devkit-exit-5-1 &> logs
    logs5=$(cat logs)
    sleep 1
done
echo "Node 5 running"
echo "All nodes ready!"

echo "Waiting for node to find each other and channels to open"
until [[ $pluto == true ]]; do
    docker logs devkit-pluto-1 &> logs
    logs_pluto=$(cat logs | grep "Terminating this script will clean up the running local cluster" | head -1)
    [[ ! -z "$logs_pluto" ]] && pluto=true
done
echo "Done!"

# Extract entry and exit node peer ids from pluto logs
entry_node_peer_id=$(cat logs |grep "node1" -A 1 | grep "Peer Id" | awk '{ print $5 }')
exit_node_peer_id=$(cat logs |grep "node5" -A 1 | grep "Peer Id" | awk '{ print $5 }')

# Run tests with env variables
ENTRY_NODE_PEER_ID="$entry_node_peer_id" EXIT_NODE_PEER_ID="$exit_node_peer_id" HOPRD_API_TOKEN="$HOPRD_API_TOKEN" \
yarn test

# After tests exit tear down setup
docker compose down
rm ./logs