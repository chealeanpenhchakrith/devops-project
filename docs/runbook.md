# Runbook: MyApp HighErrorRate

## Symptoms

- Prometheus reports `HighErrorRate` as pending or firing.
- The `http_requests_total` 5xx ratio is above 10% for at least two minutes.
- Users may see intermittent HTTP 500 responses; the Grafana error-rate panel may rise.

## Quick checks

1. Check the application Pods and recent rollout:

   ```bash
   kubectl get pods -n dev -l app=myapp
   kubectl rollout status deployment/myapp -n dev
   kubectl rollout history deployment/myapp -n dev
   ```

2. Check Prometheus **Status → Targets** and confirm the `myapp` target is `UP`.
3. Run the error-ratio query from `monitoring/queries/part4-1-promql.md` and inspect recent logs:

   ```bash
   kubectl logs deployment/myapp -n dev --tail=100
   ```

4. Compare the alert start time with recent deployments, traffic changes, and application logs.

## Mitigation

1. If the alert began after a rollout and the previous version was healthy, roll back first:

   ```bash
   kubectl rollout undo deployment/myapp -n dev
   kubectl rollout status deployment/myapp -n dev
   ```

2. If rollback does not help, identify the failing route from the structured logs and
   reduce or disable the affected traffic path while investigating.
3. Confirm that the 5xx ratio falls below 10%, the `myapp` target remains `UP`, and
   `HighErrorRate` returns to normal before closing the incident.

## Escalation

If errors persist after rollback or affect all routes, notify the service owner and
record the incident timeline. Preserve logs and Prometheus data for the postmortem.
