# Lab 4 — Part 4.1 PromQL queries

Run each expression in the Prometheus expression browser with the Lab 4
Prometheus server selected. Use a `5m` range so the rate and histogram estimates
have enough samples.

## Traffic — requests per second

```promql
sum(rate(http_requests_total[5m]))
```

The result is the total HTTP request rate across the application, in requests per
second.

Save the Prometheus query/result screenshot as `monitoring/evidence/part4.1/traffic.png`.

## Errors — ratio of HTTP 5xx responses

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))
```

The result is a fraction from 0 to 1. Format it as a percentage in Grafana. If no
requests have been scraped in the selected range, Prometheus may return no value.

Save the Prometheus query/result screenshot as `monitoring/evidence/part4.1/error-ratio.png`.

## Latency — 95th percentile

```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

The result is the estimated p95 request duration in seconds, calculated from the
application's histogram buckets.

Save the Prometheus query/result screenshot as `monitoring/evidence/part4.1/p95-latency.png`.

## Saturation — memory usage per Pod

```promql
sum(container_memory_working_set_bytes{namespace="dev"}) by (pod)
```

The result is working-set memory in bytes for each Pod in the `dev` namespace.
Select the bytes unit when displaying it.

Save the Prometheus query/result screenshot as `monitoring/evidence/part4.1/pod-memory.png`.
