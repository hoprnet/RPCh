#!/bin/bash

# If there's a fatal error or users Ctrl+C it will tear down setup
trap 'docker compose -f ../sandbox/docker-compose.yml down; rm ./logs; exit' SIGINT || trap 'docker compose -f ../sandbox/docker-compose.yml down; rm ./logs; exit' SIGKILL

#  Run docker compose as daemon
docker compose -f ../sandbox/docker-compose.yml up -d --remove-orphans --build --force-recreate

# Extract HOPRD_API_TOKEN from env file
source ../sandbox/.env

logs1=""
logs2=""
logs3=""
logs4=""
logs5=""
logs_pluto=""
logs_error=""
segmentation_error=""
pluto=false
sleep 10

until [[ $logs1 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs sandbox-exit-1-1 &> logs
    logs1=$(cat logs)
    sleep 1
done
echo "Node 1 running"

until [[ $logs2 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs sandbox-exit-2-1 &> logs
    logs2=$(cat logs)
    sleep 1
done
echo "Node 2 running"

until [[ $logs3 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs sandbox-exit-3-1 &> logs
    logs3=$(cat logs)
    sleep 1
done
echo "Node 3 running"

until [[ $logs4 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs sandbox-exit-4-1 &> logs
    logs4=$(cat logs)
    sleep 1
done
echo "Node 4 running"

until [[ $logs5 =~ "Listening for incoming messages from HOPRd" ]]; do
    docker logs sandbox-exit-5-1 &> logs
    logs5=$(cat logs)
    sleep 1
done
echo "Node 5 running"
echo "All nodes ready!"

echo "Waiting for node to find each other and channels to open"
until [[ $pluto == true ]]; do
    docker logs sandbox-pluto-1 &> logs
    logs_pluto=$(cat logs | grep "Terminating this script will clean up the running local cluster" | head -1)
    logs_error=$(cat logs | grep "Cleaning up processes" | head -1)
    segmentation_error=$(cat logs | grep "Segmentation fault" | head -1)
    # Check for a segmentation fault or if the retries are over
    if [[ ! -z "$logs_error" || ! -z "$segmentation_error" ]]; then
        echo "Unrecoverable error"
        echo "Exiting..."
        docker compose -f ../sandbox/docker-compose.yml down
        rm ./logs
        exit
    fi

    [[ ! -z "$logs_pluto" ]] && pluto=true
done
echo "Done!"

# Extract entry and exit node peer ids from pluto logs
entry_node_peer_id=$(cat logs |grep "node1" -A 1 | grep "Peer Id" | awk '{ print $5 }')
exit_node_peer_id=$(cat logs |grep "node5" -A 1 | grep "Peer Id" | awk '{ print $5 }')

# Run tests with env variables
ENTRY_NODE_PEER_ID="$entry_node_peer_id" EXIT_NODE_PEER_ID="$exit_node_peer_id" ENTRY_NODE_API_TOKEN="$HOPRD_API_TOKEN" \
npx jest --coverage

# After tests exit tear down setup
docker compose -f ../sandbox/docker-compose.yml down
rm ./logs