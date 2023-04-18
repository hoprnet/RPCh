# RPCh Exit Node

## Description

RPCh Exit Node is an application which will be able to fulfil RPC requests and return them back. It awaits for incoming requests and will perform an external request to the embedded provider URL and return the response.

## Run with Docker

To be able to run the funding platform with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t exit-node -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e HOPRD_API_ENDPOINT="<YOUR HOPRD API ENDPOINT>" \
-e HOPRD_API_TOKEN="<YOUR HOPRD API TOKEN>" \
-e DEBUG="rpch*,-*verbose,-*metrics" \
-e RPCH_PASSWORD="PleaseChangeMe" \
-e RPCH_IDENTITY_FILE= \
-e RPCH_PRIVATE_KEY= \
-e RPCH_DATA_DIR= \
exit-node
```

## Run with Docker Compose (run hoprd node too)

To run a exit-node and a hoprd node at the same time, run the following command in the exit-node directory:

```sh
docker compose up
```

When wanting to stop the exit-node and hoprd node, you can:

For linux or windows: ```CTRL + C```

For OSX: ```CMD + C```

or if you are running the docker as a daemon, execute the following command in the exit-node directory:

```sh
docker compose down
```
