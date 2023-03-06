# Metrics

This file is documenting and tracking all the metrics which can be collected
by a Prometheus server. The metrics can be scraped by Prometheus from
the `api/metrics` API endpoint.

The following section documents the metrics:

| Name                                       | Type    | Description                                                   | Note                       |
| ------------------------------------------ | ------- | ------------------------------------------------------------- | :------------------------- |
| `counter_fetched_entry_nodes`  | counter | Number of times we have given an entry node to user|      |
| `counter_trial_clients`  | counter | Number of times we have created a trial client|      |
| `counter_trial_clients`  | counter | Number of times we have created a trial client|      |
| `counter_added_quota`  | counter | Number of times quota has been added through endpoint|      |
