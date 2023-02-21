# Funding service

## Description

In the RPCh ecosystem, we would like to incentivize node participation. While the discovery platform handles who is being rewarded with funds, we need to have a way for them to be sent to the nodes.
The funding service acts as a standalone service which it’s purpose is to solely send funds to nodes, it is only accessible via our VPC and it’s not exposed publicly.

![Diagram of how funding service works](./architecture.png "Funding service Overview")

## Run with Docker

To be able to run the funding service with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t funding-service -f Dockerfile ../../
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
funding-service
```

## How to create new migrations
You can create new a new migration with `yarn migrate create [name-of-migration]`, after creating this migration you can test it
inside `db` tests or running docker image. For more info on what you can run with `yarn migrate` check [docs](https://salsita.github.io/node-pg-migrate/#/cli)
### How migrations are running right now
Migrations are being ran programmatically in `runMigrations`, this function runs all migrations inside the folder `migrations` 
and stores passed migrations in a `migrations` table.