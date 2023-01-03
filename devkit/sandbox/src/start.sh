#!/bin/bash

# prevent sourcing of this script, only allow execution
$(return >/dev/null 2>&1)
test "$?" -eq "0" && { echo "This script should only be executed." >&2; exit 1; }

# set working dir to this file's dir
cd "$(dirname "$0")"

cleanup() {
	docker-compose --file ./nodes-docker-compose.yml down;
	docker-compose --file ./central-docker-compose.yml down;
	exit;
}

# If there's a fatal error or users Ctrl+C it will tear down setup
trap 'cleanup' SIGINT SIGKILL SIGTERM ERR EXIT

echo "Starting 'nodes-docker-compose' and waiting for funding & open channels"

#  Run docker compose as daemon
rm -f ./logs;
docker compose -f ./nodes-docker-compose.yml up -d --remove-orphans --build --force-recreate

# Extract HOPRD_API_TOKEN from env file
source ./.env

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
        cleanup
        exit
    fi

    [[ ! -z "$logs_pluto" ]] && pluto=true
done

echo "Done 'nodes-docker-compose', starting 'central-docker-compose'"

# fund funding-service wallet
hoprTokenAddress=$( \
    RPC_PROVIDER=http://localhost:8545 FUNDING_HOPRD_API_ENDPOINT=http://localhost:13301 \
    FUNDING_HOPRD_API_TOKEN=${HOPRD_API_TOKEN} npx ts-node ./src/fund-funding-service.ts
)

echo "hoprTokenAddress"
echo $hoprTokenAddress

# eval $( \
#     RPC_PROVIDER=http://localhost:8545 FUNDING_HOPRD_API_ENDPOINT=http://localhost:13301 \
#     FUNDING_HOPRD_API_TOKEN=${HOPRD_API_TOKEN} npx ts-node ./fund-funding-service.ts
# ) && node apps/funding-service/build/index.js

# DEBUG=\"rpch*,-*metrics\" docker-compose --project-name sandbox --file ./src/docker-compose.yml up