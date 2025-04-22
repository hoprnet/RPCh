# Availability Monitor

Availability Monitor is a service that determines best available routes through hoprd mixnet.
The Availability Monitor uses the same database as the Disocvery Platform.
The Disocvery Platform is the source of truth of the database containing all migrations.

## Run with Docker

To be able to run the availability monitor with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build  --platform linux/amd64 -t availability-monitor -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker rm -f availability-monitor || true
docker run \
--platform linux/amd64 \
--name availability-monitor \
-e PGHOST="host.docker.internal" \
-e PGPORT="5432" \
-e PGDATABASE="<YOUR DB NAME>" \
-e PGUSER="<YOUR DB USER>" \
-e PGPASSWORD="<YOUR DB PASSWORD>" \
-e PGSSLMODE="verify-ca" \
-e PGSSLCERT="/app/ssl/client-cert.pem" \
-e PGSSLKEY="/app/ssl/client-key.pem" \
-e PGSSLROOTCERT="/app/ssl/server-ca.pem" \
-e DEBUG="rpch:availability-monitor*,-*verbose" \
-v ../discovery-platform/ssl:/app/ssl \
availability-monitor
```
