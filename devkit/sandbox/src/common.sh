#!/usr/bin/env /bash

# path to this file
DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)

# safe curl: error when response status code is >400
scurl() {
    curl --silent --show-error --fail "$@" || exit 1
}

# stop sandbox
stop() {
    echo "Stopping 'rpch-sandbox'"
    docker compose -f $DIR/docker-compose-1-nodes.yml -p rpch-sandbox down -v;
    docker compose -f $DIR/docker-compose-2-nodes-dp-pg.yml -p rpch-sandbox down -v;
    docker compose -f $DIR/docker-compose-3-am.yml -p rpch-sandbox down -v;
    docker compose -f $DIR/docker-compose-4-rpc-server.yml -p rpch-sandbox down -v;
    rm -f $DIR/logs;
    echo "Sandbox has stopped!"
}

# start sandbox
start() {
    # stop if already running
    stop

    echo "Starting nodes. Waiting for funding & open channels"

    #  Run docker compose as daemon
    docker compose -f $DIR/docker-compose-1-nodes.yml -p rpch-sandbox \
        up -d --remove-orphans --build --force-recreate --renew-anon-volumes

    # Extract HOPRD_API_TOKEN from env file
    source $DIR/.env

    logs1=""
    logs2=""
    logs3=""
    logs4=""
    logs5=""
    logs_pluto=""
    logs_error=""
    segmentation_error=""
    pluto=false

    echo "Waiting for exit nodes setup"

    until [[ $logs1 =~ "verbose opened websocket listener" ]]; do
        docker logs rpch-sandbox-exit-1-1 &> $DIR/logs
        logs1=$(cat $DIR/logs)
        sleep 1
    done
    echo "Node 1 running"

    until [[ $logs2 =~ "verbose opened websocket listener" ]]; do
        docker logs rpch-sandbox-exit-2-1 &> $DIR/logs
        logs2=$(cat $DIR/logs)
        sleep 1
    done
    echo "Node 2 running"

    until [[ $logs3 =~ "verbose opened websocket listener" ]]; do
        docker logs rpch-sandbox-exit-3-1 &> $DIR/logs
        logs3=$(cat $DIR/logs)
        sleep 1
    done
    echo "Node 3 running"

    until [[ $logs4 =~ "verbose opened websocket listener" ]]; do
        docker logs rpch-sandbox-exit-4-1 &> $DIR/logs
        logs4=$(cat $DIR/logs)
        sleep 1
    done
    echo "Node 4 running"

    until [[ $logs5 =~ "verbose opened websocket listener" ]]; do
        docker logs rpch-sandbox-exit-5-1 &> $DIR/logs
        logs5=$(cat $DIR/logs)
        sleep 1
    done
    echo "Node 5 running"
    echo "All exit nodes ready!"

    echo "Waiting for node to find each other and channels to open"
    until [[ $pluto == true ]]; do
        docker logs rpch-sandbox-pluto-1 &> $DIR/logs
        logs_pluto=$(cat $DIR/logs | grep "Terminating this script will clean up the running local cluster" | head -1)
        logs_error=$(cat $DIR/logs | grep "Cleaning up processes" | head -1)
        segmentation_error=$(cat $DIR/logs | grep "Segmentation fault" | head -1)
        # Check for a segmentation fault or if the retries are over
        if [[ ! -z "$logs_error" || ! -z "$segmentation_error" ]]; then
            echo "Unrecoverable error"
            echo "Exiting..."
            stop
            exit
        fi

        [[ ! -z "$logs_pluto" ]] && pluto=true
    done

    echo "Done 'nodes-docker-compose'"

    # get HOPR Token address
    until [[ $hoprTokenAddress =~ "0x" ]]; do
        info=$(
            scurl "http://localhost:13301/api/v3/node/info" \
                -H "Content-Type: application/json" \
                -H "x-auth-token: HOPRD_API_TOKEN" 
        );
        hoprTokenAddress=$(jq -r -n --argjson data "$info" "$info.hoprToken")
        sleep 1
    done
    echo "Received hoprTokenAddress: $hoprTokenAddress"

    echo "Starting PostgreSQL and Discovery Platform"
    FORCE_SMART_CONTRACT_ADDRESS="$hoprTokenAddress" \
        docker compose -f $DIR/docker-compose-2-nodes-dp-pg.yml -p rpch-sandbox \
        up -d --build --force-recreate
    echo "Done starting PostgreSQL and Discovery Platform"


    echo "Prepopulating the DB"
    node ../sandbox/build/index.js

    echo "Starting availability monitor"
    docker compose -f $DIR/docker-compose-3-am.yml -p rpch-sandbox \
        up -d --build --force-recreate
    echo "Done starting availability monitor and RPC server"

    echo "Waiting for 0-hop and 1-hop routes"
    node ../sandbox/build/waitForRoutes.js

    echo "Starting RPC server"
    docker compose -f $DIR/docker-compose-4-rpc-server.yml -p rpch-sandbox \
        up -d --build --force-recreate
    echo "Done starting RPC server"

    exit_code=1

    echo "Sandbox has started!"
}
