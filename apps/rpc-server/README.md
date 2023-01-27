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
-e HOPRD_API_ENDPOINT="<YOUR HOPRD API ENDPOINT>" \
-e HOPRD_API_TOKEN="<YOUR HOPRD API TOKEN>" \
-e DEBUG="rpch*,-*verbose,-*metrics" \
-e RPCH_PASSWORD="PleaseChangeMe" \
-e RPCH_IDENTITY_DIR= \
-e RPCH_PRIVATE_KEY= \
-e RPCH_DATA_DIR= \
exit-node
```
