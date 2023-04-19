# Metrics

This file is documenting and tracking all the metrics which can be collected
by a Prometheus server. The metrics can be scraped by Prometheus from
the `api/metrics` API endpoint.

The following section documents the metrics:

| Name                                       | Type    | Description                                                   | Note                       |
| ------------------------------------------ | ------- | ------------------------------------------------------------- | :------------------------- |
| `counter_successful_request`  | counter | amount of successful requests discovery platform has processed|      |
| `counter_failed_request`  | counter | amount of failed requests discovery platform has processed|      |
| `request_duration_seconds`  | histogram | duration of requests in seconds |      |
