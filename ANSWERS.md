# Lab 1 - Answers to Questions 1 to 5

## Question 1 - Why forbid direct pushes to main?
Pull requests allow team members to review changes before merging them into main. This
avoid breaking the shared application and let us to trace the linked validation and 
discussion. We have to configure required checks in the branch protection settings to
enforce team to do ti.

## Question 2 - What is the difference between an image and a container?

An image is a template, it has the application, its dependencies and its runtime
configuration. A container is an instance of the image, it has its own writable
layer. Serveral containers can have the same image, and can be running or stopped
independently.

## Question 3 - Compare the image size with a non-slim base image

The sizes previously recorded for this project are:
Lightweight single-stage build: 202 MB
Lightweight multi-stage build: 199 MB
Full single-stage build: 1.58 GB

3.2
<img width="1903" height="898" alt="3 2" src="https://github.com/user-attachments/assets/e42be2e7-a3a3-4255-b6c4-ec7a04bd6979" />


3.3
<img width="1864" height="891" alt="3 3" src="https://github.com/user-attachments/assets/4c45baa8-89d4-4f73-a276-a8941c3e1943" />



The Alpine-based image is about 87% smaller than the full image. Its base contains
fewer system packages and tools, which reduces storage and transfer requirements.
Alpine is a separate lightweight variant, rather than the official node:20-slim tag.
These sizes depend on the image versions, platform and measurement method.

Bonus: the multi-stage build saves about 3 MB in the recorded comparison. The gain
is small because the single-stage Dockerfile already installs only production
dependencies. Multi-stage builds are especially useful when compilation tools or
other build dependencies can be excluded from the final image.

## Question 4 - Why tag the image with the commit SHA rather than latest?

A commit SHA tag builds a connection between an image and a specific source revision. 
That makes it easier to trace a version through its commit, pipeline run and published 
image. And it's also easier to select a previous version for rollback. The latest can 
also point to a different version after each publication.

A SHA-based tag is a Docker tag , it can be overwritten. An image digest shows the 
exact image content; The image can be different with inputs chage on its base image,
even if we rebuild the same commit.

## Question 5 - What does fail fast mean in a pipeline?

It means being able to find a failure as early as possible and to skip subsequent steps
that depend on its succes. Cheap checks like lint and tests always be done before more 
expensive operations like building and publishing an image.

In this workflow, a failing test can stop the build image step from running, and we can 
skip the the publish job because of its failure. A failing check also stop merging if 
Build and test is configured as a required status check
on main.

Link to the image published in the registry
https://github.com/chealeanpenhchakrith/devops-project/pkgs/container/devops-project

---

# Lab 2 - Kubernetes, Multi-environment Deployment and Audit

Answers to the eight questions of Lab 2 (Session 2). The commands and outputs quoted
below were produced on the local kind cluster `devops-lab` (Kubernetes v1.37) with the
manifests in `k8s/`; the raw terminal output is in `evidence/`.

## Lab 2 - Question 1 - What is the role of a namespace? Does it provide strong security isolation by itself?

A namespace is a **logical partition of a cluster**: it gives a scope for object names
(two `myapp` Deployments can coexist in `dev` and `prod`), a scope for RBAC
(`Role`/`RoleBinding` are namespaced, so the `viewer` service account can list pods in
`dev` but not in `prod`), a scope for policies and quotas (`ResourceQuota`,
`LimitRange`, `NetworkPolicy`) and, in practice, the unit that `kubectl -n <ns>` and
most tooling work with.

It is **not a security boundary by itself**:

- isolation is only *logical*: all pods share the same node kernel, the same container
  runtime and often the same network;
- pods can reach pods of another namespace by default (`myapp.dev.svc.cluster.local`
  is resolvable from any namespace); only a `NetworkPolicy` (with a CNI that enforces
  it) creates a network boundary;
- cluster-scoped objects are shared and visible across namespaces: `Node`,
  `PersistentVolume`, `ClusterRole`, `CustomResourceDefinition`;
- a pod that mounts `hostPath`, uses `hostNetwork`/`hostPID` or runs `privileged`
  escapes the namespace entirely;
- RBAC, not the namespace, decides who may read or change what, and a single
  over-privileged ClusterRole applies to every namespace.

So a namespace is a *scoping and governance* tool; real isolation needs RBAC,
NetworkPolicies, quotas, Pod Security Admission, and - for a hard boundary - a separate
cluster (or at least separate nodes with taints).

## Lab 2 - Question 2 - Why does Kubernetes recreate the deleted pod? Which component is responsible?

Because the cluster is driven by a **reconciliation loop**: the desired state says
`replicas: 3`, the actual state had 3 pods, and after `kubectl delete pod` it has 4-1.
The controller compares desired and observed state and creates a replacement.

The chain is: the **Deployment** controller (in `kube-controller-manager`) owns a
**ReplicaSet** whose `spec.replicas` is 3; the **ReplicaSet** controller notices
`status.replicas < spec.replicas`, creates a new Pod object through the API server, the
**scheduler** binds it to a node, and the **kubelet** on that node starts the container.
`kubectl get pods` then shows a pod with a *new* name: the replacement is a new object,
not the old one resurrected.

That is also why deleting pods manually is not a way to "scale down": the ReplicaSet
creates them back. Only changing `spec.replicas` (through the Deployment) persists.

## Lab 2 - Question 3 - What is the difference between a readiness and a liveness probe? What happens to traffic when readiness fails?

- **Readiness** answers *"can this pod receive traffic right now?"*. It is a gate on the
  Service endpoints: while the readiness probe fails, the pod IP is removed from the
  Service's EndpointSlice, so kube-proxy stops sending new requests to it. The
  container is **not** restarted: it keeps running, it may finish a warm-up, and it can
  come back into the endpoints when the probe succeeds again.
- **Liveness** answers *"is this container still alive / not wedged?"*. When it fails
  often enough, the **kubelet restarts the container** (per `restartPolicy: Always`),
  which is a much more brutal action.

Consequence of a readiness failure: the pod stays `Running` but `READY 0/1`; its IP
leaves the endpoints, traffic goes to the remaining ready pods. If **all** pods of a
Service are unready, the Service has no endpoints and clients get connection errors or
503 - that is exactly what the rolling update with `maxUnavailable: 0` prevents: a new
ReplicaSet only replaces the old pods once the new ones are ready.

In this lab the probes hit `GET /health`. A useful rule: liveness should check only
that the process is alive (a broken dependency must not restart-loop the whole
fleet); readiness is the right place to check dependencies (database, cache).

Observed in `evidence/07-probe-failure.txt`: with the readiness path changed to
`/nope`, the new pod stayed `0/1 Running`, the kubelet logged
`Readiness probe failed: HTTP probe failed with statuscode: 404`, the rollout stalled,
and the old pods kept serving traffic.

## Lab 2 - Question 4 - Is a Kubernetes Secret encrypted by default? How would you improve this?

**No.** A Secret stores `base64`-encoded values in `data` (or plain text in
`stringData`), and base64 is **encoding, not encryption**: anybody who can read the
object (`kubectl get secret -o yaml`) reads the value. By default the Secret is stored
in **etcd in clear text** unless encryption at rest is configured, it is copied in
clear text into the container environment or the mounted volume, and it is readable by
any process of the pod (and by any pod mount if it is mounted cluster-wide).

How to improve it:

1. **Encryption at rest**: an `EncryptionConfiguration` on the API server for the
   `secrets` resource (aescbc/aesgcm/KMS provider), plus etcd disk encryption and
   restricted etcd access.
2. **RBAC least privilege**: almost nobody needs `get/list` on `secrets`; the `viewer`
   account of Part 6 cannot read them (`get secrets -> no` in `evidence/11-rbac.txt`).
3. **External secret managers**: Vault, cloud KMS/Secret Manager, External Secrets
   Operator or Sealed Secrets, so the Git repository only holds a reference, never the
   value. (In this lab the Secret contains a fake value on purpose: `API_KEY=changeme`.)
4. **Reduce exposure inside the pod**: inject as a **file** (volume mount) instead of
   an environment variable (env vars leak into `kubectl describe`, crash dumps and
   child processes), keep the pod as non-root with a read-only root filesystem, and
   rotate the credentials.
5. **Admission control and audit**: OPA Gatekeeper/Kyverno to refuse Secrets in
   plain-text manifests or namespaces, audit logs on `secrets` at `Metadata` level
   (never `RequestBody`), and alerts on unusual reads.
6. **Short-lived credentials**: projected service-account tokens, workload identity,
   dynamic database credentials rather than long-lived static keys.

## Lab 2 - Question 5 - How does this pattern help with hybrid/multi-cloud deployments? What would differ between a real on-prem cluster and a cloud cluster?

The Kustomize pattern keeps **one base** (the workload contract: image, probes,
resources, Service shape) and puts only the differences in **per-target overlays**
(`dev`, `staging`, `prod`, which simulate on-prem, cloud A and cloud B here). One
source of truth, many targets: the same reviewed diff can be promoted to a second
provider without a fork, and what differs is explicit, reviewable and diffable
(`kubectl diff -k`). With GitOps (Argo CD/Flux) each cluster pulls the overlay that
matches it, so a cluster can only drift by being changed outside Git.

What genuinely differs between a real on-prem cluster and a cloud cluster:

| Concern | On-prem | Cloud |
|---|---|---|
| Entry point | no managed load balancer: `NodePort`, MetalLB or an Ingress controller | `Service type: LoadBalancer`, managed ingress/DNS |
| Storage | local-path, Ceph, NFS: you operate the CSI driver and backups | managed CSI, per-class volumes, snapshots |
| Control plane | you run and upgrade it, back up etcd, patch it yourself | managed (EKS/GKE/AKS), version skew handled by the provider |
| Identity | LDAP/AD/OIDC, static kubeconfigs | cloud IAM, Workload Identity/IRSA, short-lived tokens |
| Capacity | fixed hardware, you own the scaling/cost trade-off | autoscaler, ephemeral nodes, spot instances |
| Network | your VLANs, firewalls, VPN to the other site | VPC peering, private endpoints, egress costs |
| Registry | internal registry/mirror, air-gapped | GHCR/ECR/GAR with pull secrets or node-level identity |
| Compliance | data stays on site | data residency depends on region |

Hence the overlay content differs (`type: LoadBalancer` vs `NodePort`, storage class,
node selectors/taints, image registry mirror, resource sizing), while the base stays
identical - which is exactly what makes a hybrid or multi-cloud strategy operable.

## Lab 2 - Question 6 - Why did the broken rollout not take down the application?

Because a Deployment replaces pods **gradually and only after the new ones are
Ready**. The pod template changed, so a new ReplicaSet was created; its pod could not
start (`ImagePullBackOff` on the `deadbeef...` tag in `evidence/09-broken-tag.txt`),
so it never became Ready. With `maxSurge: 1` / `maxUnavailable: 0` the Deployment may
not remove any old pod before a new one is available, so the five old pods kept
running, the Service kept the same endpoints, and `GET /health` on prod still answered
`OK`. The rollout simply stayed in progress ("Waiting for deployment ... 1 out of 5 new
replicas have been updated") until it was undone with `kubectl rollout undo`, which
restored the previous ReplicaSet.

This is the safety net of the rolling strategy: a bad image or a failing readiness
probe costs availability only if `maxUnavailable` allows it. The cost is a stalled
rollout and a stuck new ReplicaSet - visible in `kubectl rollout status` and in the
`ProgressDeadlineExceeded` condition when a deadline is configured.

## Lab 2 - Question 7 - Starting from a pod running in production, how can you find the commit, the reviewer and the pipeline run that produced it?

The pod itself is the starting point, and the chain is designed to be walkable in
both directions:

1. `kubectl get pod -n prod <pod> -o yaml` gives the **image tag**. In this project the
   tag **is** the commit SHA (`ghcr.io/.../devops-project:4b4ba17...`), so the commit
   comes straight from the tag (and from the `git-commit` annotation, which the overlay
   keeps in sync with the image).
2. `pipeline-run-url` (and `owner`, `ticket`) annotations on the Deployment point to
   the exact GitHub Actions run; from the run, the workflow file, the logs and the
   commit are one click away.
3. On GitHub: commit -> Pull Request -> **reviewers and their approvals** (the PR page
   lists them, and branch protection required two) -> merge commit -> the `publish`
   job that pushed the image.
4. Registry side: `docker inspect` / the GHCR package page shows the image digest and
   its annotations; an OCI label such as `org.opencontainers.image.revision` and
   `...source` makes the link explicit even outside Kubernetes.
5. For anything older, the API-server **audit log** answers "who did what, when" for
   the `kubectl apply` that created or updated the object.

Concretely for this lab: pod -> image `:4b4ba17...` -> annotation
`pipeline-run-url=https://github.com/.../actions/runs/44057532758` -> commit
`4b4ba17` -> PR #2 -> approvals from two reviewers.

## Lab 2 - Question 8 - Why is manual `kubectl edit` in production a traceability risk?

Because it changes the live object **without going through Git, review or CI**:

- the Git repository no longer describes what actually runs: the declared state and the
  real state diverge (configuration drift), and the next `kubectl apply -k` silently
  reverts the change - or, worse, an unrelated apply wipes out a hotfix nobody
  recorded;
- no Pull Request means no reviewer, no approval, no required-check run: the change
  never passed lint, tests or the image build, and nothing proves who validated it;
- the audit log records *who* ran `kubectl edit` and *what* changed, but not *why*
  (no ticket, no discussion), and the change is invisible in `git log`;
- there is no rollback record: the Deployment revision history exists, but the intent
  behind the revision does not, so a postmortem cannot reconstruct the decision;
- it bypasses the policies enforced in the pipeline (image pinned by SHA, probes,
  resources, non-root) - a manual edit can remove a probe or a resource limit in
  seconds;
- it breaks the commit -> pipeline -> image -> deploy chain that the whole lab is
  about: the running object no longer maps to a commit.

The accepted patterns are: change the overlay, open a PR, let CI build and let CD (or
GitOps) apply, and keep a **break-glass** procedure (elevated, audited, time-boxed,
followed by a PR that reconciles Git with what was done by hand).
