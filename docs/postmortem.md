# Postmortem: Local MyApp 5xx Incident

## Summary and impact

During the Lab 4 incident simulation, the deliberately faulty image `devops-project:part6-bad` was deployed to `myapp` in the `dev` namespace. Business requests returned HTTP 500, while `/health` and `/metrics` remained available. Prometheus detected the elevated 5xx ratio and `HighErrorRate` entered FIRING after the condition remained above 10% for two minutes. The screenshot showed a 72.6% 5xx ratio.

The impact was limited to the local Minikube `dev` environment. No production users or data were affected. Rolling back to `devops-project:lab4` restored the service; the Pod became Ready at 1/1 and `/` returned HTTP 200.

## Timeline (UTC)

All events occurred on 2026-11-24.

- **18:23:26** — Deployed the intentionally faulty `devops-project:part6-bad` image to `dev/myapp`. The Pod became Ready, but business requests returned HTTP 500.
- **18:28:52** — An initial burst of failing requests caused `HighErrorRate` to enter Pending. Traffic stopped before the two-minute `for` period was met, so the alert did not fire.
- **18:36:52** — Sustained failing traffic caused `HighErrorRate` to enter Pending again.
- **18:39:27** — Prometheus showed `HighErrorRate` as Firing, with the 5xx ratio above the 10% threshold.
- **18:41:38** — Began mitigating the incident by rolling back `dev/myapp` to the previous Deployment revision, `devops-project:lab4`.
- **18:41 (approx.)** — Rollback completed. The Deployment was Ready at 1/1, and a request to `/` returned HTTP 200.

## Root cause and contributing factors

The faulty test image deliberately returned HTTP 500 for business routes. The `/health` and `/metrics` endpoints were excluded from the fault, so the readiness probe continued to pass and Prometheus could continue scraping the application.

The readiness probe checked process health through `/health` but did not detect failures on a business route. The deployment pipeline also had no post-deployment smoke test or canary gate based on the 5xx ratio. The initial burst did not sustain the alert condition long enough to fire; sustained traffic was needed to meet the configured two-minute `for` period.

## What went well / what went poorly

**What went well:** Prometheus continued scraping the app and raised `HighErrorRate` when the 5xx ratio stayed above the threshold. The previous healthy Deployment revision was available, so rollback restored service quickly. The recovery check confirmed the Pod was Ready and `/` returned HTTP 200.

**What went poorly:** The health probe passed while business requests were failing. The pipeline did not run a smoke test against a business route or use a progressive rollout with an error-rate check, so the faulty image became the active release before monitoring detected the incident.

## Action items (owner, deadline)

- Add a post-deployment smoke test that calls `/` and requires HTTP 200 before the release is considered successful. **Owner:** Application/CI maintainer. **Deadline:** 2026-12-01.
- Add a canary rollout gate that stops or rolls back a release if the Prometheus 5xx ratio stays above 10% for two minutes. **Owner:** Platform/CI maintainer. **Deadline:** 2026-12-08.
