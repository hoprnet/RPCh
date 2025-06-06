# Discovery Platform

For the RPCh SDK to be usable, it needs to know which HOPRd entry nodes and HOPRd exit nodes it can use.
The Discovery Platform requires participants in the RPCh network to be registered.
That way, it can provide the RPCh SDK with a list of participants.
The Discovery Platform is the source of truth for the RPCh database. It contains all migrations.
Exit nodes report quota usages to the Discovery Platform.

## Run with Docker

To be able to run the discovery platform with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build --platform linux/amd64 -t discovery-platform -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker rm -f discovery-platform || true
docker run \
--platform linux/amd64 \
--name discovery-platform \
-e PORT="3020" \
-e URL="http://localhost:3020" \
-e PGHOST="host.docker.internal" \
-e PGPORT="5432" \
-e PGDATABASE="<YOUR DB NAME>" \
-e PGUSER="<YOUR DB USER>" \
-e PGPASSWORD="<YOUR DB PASSWORD>" \
-e PGSSLMODE="verify-ca" \
-e PGSSLCERT="/app/ssl/client-cert.pem" \
-e PGSSLKEY="/app/ssl/client-key.pem" \
-e PGSSLROOTCERT="/app/ssl/server-ca.pem" \
-e ADMIN_SECRET="<SECRET FOR AUTHORIZING AS ADMIN>" \
-e DEBUG="rpch:discovery-platform*,-*verbose" \
-v ./ssl:/app/ssl \
-p 3020:3020 \
discovery-platform
```


## How to create new migrations

You can create new a new migration with `yarn migrate create <name-of-migration>`, after creating this migration you can test it
inside `db` tests or running docker image. For more info on what you can run with e.g. `PGHOST="host.docker.internal" PGPORT="5432" PGDATABASE="<YOUR DB NAME>" PGUSER="<YOUR DB USER>" PGPASSWORD="<YOUR DB PASSWORD>" rpch_dp yarn run migrate up` check [docs](https://salsita.github.io/node-pg-migrate/#/cli)

### How migrations are running right now

Migrations are being ran programmatically in `runMigrations`, this function runs all migrations inside the folder `migrations`
and stores passed migrations in a `migrations` table.
