# Kubernetes manifests (Lab 2)

Declarative deployment of the Session 1 application, with one base and three
environment overlays, applied with Kustomize (built into `kubectl`).

```
k8s/
├── base/
│   ├── kustomization.yaml      # resources + ConfigMap/Secret generators
│   ├── deployment.yaml         # myapp: 3 replicas, probes, resources, annotations
│   └── service.yaml            # myapp: ClusterIP 80 -> 3000
├── overlays/
│   ├── dev/kustomization.yaml      # 1 replica, APP_ENV=dev,   image tag: 1.1.0
│   ├── staging/kustomization.yaml  # 2 replicas, APP_ENV=staging, cloud-a
│   └── prod/kustomization.yaml     # 5 replicas, APP_ENV=prod, cloud-b, pinned release
├── rbac/
│   ├── serviceaccount.yaml     # viewer (namespace dev)
│   └── role-and-binding.yaml   # pod-reader: get/list/watch pods, get pods/log
└── namespaces.yaml             # dev, staging, prod
```

## What the base guarantees

| Setting | Value | Why |
|---|---|---|
| replicas | 3 | the Lab 2 requirement; overlays override it |
| image | `ghcr.io/<owner>/devops-project:<commit-sha>` | immutable tag, one commit = one image |
| containerPort | 3000 | the Express app port from Lab 1 |
| Service | `ClusterIP` 80 -> `targetPort: 3000` | stable DNS name `myapp` in the namespace |
| readinessProbe | `GET /health` on 3000, period 5s | a pod only receives traffic when ready |
| livenessProbe | `GET /health` on 3000, initialDelay 10s | a wedged container is restarted |
| resources | requests 100m/128Mi, limits 500m/256Mi | scheduleable and bounded |
| securityContext | `runAsNonRoot`, uid 1000, no privilege escalation, all capabilities dropped | matches the non-root image from Lab 1 |
| annotations | `git-commit`, `pipeline-run-url`, `owner`, `ticket` | traceability (Part 6) |
| imagePullSecrets | `ghcr-pull` | the GHCR package is private |

The overlays change only what differs per environment: `namespace`, replica count,
`env`/`cloud` labels, `APP_ENV` in the ConfigMap, the image tag, and the `git-commit`
annotation (patched so it always matches the deployed tag).

## Usage

```bash
# cluster and namespaces (kind)
kind create cluster --name devops-lab
kubectl apply -f k8s/namespaces.yaml

# private registry: credentials as a Secret, never in the manifests
kubectl create secret docker-registry ghcr-pull -n dev \
  --docker-server=ghcr.io --docker-username=<github-user> \
  --docker-password=<token with read:packages>
# (same for staging and prod)

# preview, diff, apply
kubectl kustomize k8s/overlays/prod
kubectl diff -k k8s/overlays/prod
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/staging
kubectl apply -k k8s/overlays/prod

# observe
kubectl get all -n dev
kubectl port-forward svc/myapp 8080:80 -n dev
curl http://localhost:8080/health          # OK
curl http://localhost:8080/                # {"service":"devops-project","version":"1.1.0","env":"dev"}

# scaling and self-healing
kubectl scale deployment myapp --replicas=5 -n dev
kubectl delete pod <pod> -n prod           # the ReplicaSet recreates it

# rollout and rollback
kubectl rollout status deployment/myapp -n prod
kubectl rollout history deployment/myapp -n prod
kubectl rollout undo deployment/myapp -n prod

# access control
kubectl apply -f k8s/rbac/ -n dev
kubectl auth can-i list pods   -n dev --as=system:serviceaccount:dev:viewer   # yes
kubectl auth can-i delete pods -n dev --as=system:serviceaccount:dev:viewer   # no
```

## Environments

| | dev | staging | prod |
|---|---|---|---|
| namespace | `dev` | `staging` | `prod` |
| replica count | 1 | 2 | 5 |
| `APP_ENV` | dev | staging | prod |
| extra labels | - | `cloud: cloud-a` | `cloud: cloud-b` |
| image tag | `9242313` (v1.1.0) | `9242313` (v1.1.0) | `4b4ba17` (v1.0.0, current release) |
| simulated target | local / on-prem | cloud A | cloud B |

`GET /` answers with the `APP_ENV` injected by the ConfigMap, so the environment is
visible from the outside: `{"service":"devops-project","version":"1.1.0","env":"dev"}`.

## Private registry in a local kind cluster

The GHCR package of this repository is private, so the manifests reference the
`ghcr-pull` secret. On a machine where the token cannot read the package, the images
can be loaded straight into the cluster instead of being pulled:

```bash
docker tag devops-project:1.1.0 ghcr.io/chealeanpenhchakrith/devops-project:9242313...
kind load docker-image ghcr.io/chealeanpenhchakrith/devops-project:9242313... --name devops-lab
```

`imagePullPolicy: IfNotPresent` (in the base) makes the kubelet use the loaded image,
while the `imagePullSecrets` reference stays in place for the day the token can pull.

## Evidence

The terminal output of every step is in [`../evidence/`](../evidence):

| File | What it shows |
|---|---|
| `01-cluster.txt` | `kubectl cluster-info`, the kind node |
| `02-get-all.txt` | `kubectl get all` in dev, staging and prod |
| `03-env.txt` | `APP_ENV` and `API_KEY` injected in each namespace |
| `04-port-forward-dev.txt` | `/health` and `/` through `kubectl port-forward` |
| `05-self-healing.txt` | a deleted prod pod recreated by the ReplicaSet |
| `06-scaling.txt` | `scale --replicas=5` then back to 3 |
| `07-probe-failure.txt` | a broken readiness path: `0/1`, 404, rollout stalled |
| `08-rolling-update.txt` | requests sampled during the rollout (no downtime) |
| `09-broken-tag.txt` | `ImagePullBackOff` on a wrong tag, the app still serving |
| `10-rollback.txt` | `rollout undo` and the revision history |
| `11-rbac.txt` | `auth can-i` results for the `viewer` service account |

## Notes and caveats

- **`commonLabels` is deprecated** in current Kustomize; the overlays use the
  `labels:` transformer with `includeSelectors: true`, which produces the same result
  without the warning. The lecturer's example used `commonLabels`.
- **`kubectl port-forward svc/...` binds to one pod.** When a rolling update replaces
  that pod, the forward dies and curl fails even though the Service has healthy
  endpoints. The no-downtime measurement in `08-rolling-update.txt` therefore sends its
  requests from a pod inside the cluster (`http://myapp.dev.svc.cluster.local/health`).
- **`kubectl rollout history` shows `<none>` as CHANGE-CAUSE** because `--record` is
  gone; a CD pipeline sets `kubernetes.io/change-cause` before applying. The image tag
  and the `git-commit` annotation carry the same information here.
- **The audit-log bonus (6.4)** is not enabled on this cluster: kind needs a control
  plane configured with `--audit-policy-file` / `--audit-log-path` and a volume mount,
  which requires recreating the cluster from a config file. The policy from the course
  slides (`audit.k8s.io/v1`, levels None/Metadata/RequestResponse) is the one to apply.
