# Availability Monitor

Availability Monitor is a service that monitors existing registered nodes, and updates Prometheus with the nodes' stability checks.

## Run with Docker

To be able to run the availability monitor with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t availability-monitor -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e PORT="<YOUR PREFERRED PORT>" \
-e DB_CONNECTION_URL="<YOUR DB CONNECTION URL>" \
-e REVIEWER_INTERVAL_MS="<OPTIONAL: how often to queue nodes for review>" \
-e REVIEWER_CONCURRENCY="<OPTIONAL: how many reviews in parallel>" \
-e DEBUG="rpch*,-*verbose" \
availability-monitor
```
