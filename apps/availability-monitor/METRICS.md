# Metrics

This file is documenting and tracking all the metrics which can be collected
by a Prometheus server. The metrics can be scraped by Prometheus from
the `api/metrics` API endpoint.

The following section documents the metrics:

| Name                       | Type      | Description                         | Note |
| -------------------------- | --------- | ----------------------------------- | :--- |
| `guage_review_result`      | guage     | whether a node is considered stable |      |
| `request_duration_seconds` | histogram | duration of requests in seconds     |      |
