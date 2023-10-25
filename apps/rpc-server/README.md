# RPCh RPC server

## Description

When running the RPCh's RPC server, you can configure your favourite wallet to send its requests through the RPCh network.

## Run with Docker

You first need to build the image.

```sh
docker build -t rpc-server -f Dockerfile ../../
```

The docker container exposes 2 ports, `45750` for http and `45751` for https.
Support for http works out of the box. Support for https requires additional
steps to be performed on the host machine before launching the rpc server docker
container.

Launch the container for `http`-only support. \
(replace the values that have `< >`)

```sh
docker run \
  -e DEBUG="rpch:rpc-server:*" \
  -e RESPONSE_TIMEOUT=10000 \
  -e DISCOVERY_PLATFORM_API_ENDPOINT=http://localhost:3020 \
  -e FORCE_ZERO_HOP=true
  -e CLIENT="sandbox" \
  -e PORT=8080 \
  -e DATA_DIR=app \
  -p 45750:45750 \
  --platform=linux/amd64 \
  --name=rpc-server \
  --rm \
  rpc-server:latest
```

Launch the container including `https`-only. This requires the utility `mkcert`
to be installed on the host machine. Refer to their project website for
installation instructions [1]. \
(replace the values that have `< >`)

```sh
mkcert -install
mkdir -p ./certs
cd ./certs && mkcert -key-file localhost.pem.key localhost
docker run \
  -e DEBUG="rpch:rpc-server:*" \
  -e RESPONSE_TIMEOUT=10000 \
  -e DISCOVERY_PLATFORM_API_ENDPOINT=http://localhost:3020 \
  -e FORCE_ZERO_HOP=true
  -e CLIENT="sandbox" \
  -e PORT=8080 \
  -e DATA_DIR=app \
  -p 45750:45750 \
  -p 45751:45751 \
  -v "./certs:/etc/certs" \
  --platform=linux/amd64 \
  --name=rpc-server \
  --rm \
  rpc-server:latest
```

## Run natively

In the main repo folder:

```
yarn
yarn build
cd .\apps\rpc-server\
yarn start
```
