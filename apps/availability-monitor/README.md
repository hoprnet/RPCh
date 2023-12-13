# Availability Monitor

Availability Monitor is a service that determines best available routes through hoprd mixnet.
The Availability Monitor uses the same database as the Disocvery Platform.
The Disocvery Platform is the source of truth of the database containing all migrations.

## Run with Docker

To be able to run the availability monitor with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t availability-monitor -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e DATABASE_URL="<YOUR DB CONNECTION URL>" \
-e DEBUG="rpch:availability-monitor:*" \
availability-monitor
```
