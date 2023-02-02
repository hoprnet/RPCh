# RPCh RPC server

## Description

When running the RPCh's RPC server, you can configure your favourite wallet to send its requests through the RPCh network.

## Run with Docker

To be able to run the funding platform with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t rpc-server -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e DEBUG="rpch*,-*verbose,-*metrics" \
-e RESPONSE_TIMEOUT=10000 \
-e DISCOVERY_PLATFORM_API_ENDPOINT=http://localhost:3020 \
-e PORT=8080 \
-e DATA_DIR=app \
--network=host \
rpc-server
```
