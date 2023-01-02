# Funding platform

## Description

In the RPCh ecosystem, we would like to incentivize node participation. While the discovery platform handles who is being rewarded with funds, we need to have a way for them to be sent to the nodes.
The funding service acts as a standalone service which it’s purpose is to solely send funds to nodes, it is only accessible via our VPC and it’s not exposed publicly.

![Diagram of how funding platform works](./architecture.png "Funding platform Overview")

## Run with Docker

To be able to run the funding platform with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t funding-platform -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e NODE_ENV=production \
-e SECRET_KEY="PleaseChangeMe" \
-e WALLET_PRIV_KEY="<YOUR WALLET PRIV KEY>" \
-e PORT=3000 \
-e CONFIRMATIONS=1 \
-e MAX_AMOUNT_OF_TOKENS=100 \
-e TIMEOUT=3 \
-e DB_CONNECTION_URL="postgresql://<user>:<password>@<host>:5432/<db-name>" \
-e DEBUG="rpch*,-*verbose,-*metrics" \
funding-platform
```
