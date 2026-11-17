# Lab 1 - Answers to Questions 1 to 5

## Question 1 - Why forbid direct pushes to `main`?

Because `main` is the branch everything else depends on: it is the branch that CI
builds and that the `publish` job turns into a deployable image. If anyone can push
to it directly, three guarantees disappear at once:

- **No review.** A change reaches the reference branch without a second pair of eyes;
  mistakes, debug leftovers and secrets slip in unnoticed.
- **No verification.** A direct push can land even if `npm test` or `npm run lint`
  fails, so `main` stops being guaranteed green and every teammate inherits the
  breakage ("broken main, blocked team").
- **No traceability.** A Pull Request records *who* changed *what*, *why*, and *which
  pipeline run* validated it. A raw push only records the author.

With a protected branch, the only path to `main` is: branch -> Pull Request ->
review + required `build-test` checks -> merge. The history stays linear, auditable
and reversible, and the artifact published to GHCR is always built from a green,
reviewed commit.

## Question 2 - What is the difference between an image and a container?

| | Image | Container |
|---|---|---|
| Nature | Read-only template: the application filesystem plus its metadata (`CMD`, `ENV`, `EXPOSE`, ...), stored as **layers** | Running instance of an image: the read-only layers plus a thin **writable layer**, and a process |
| State | Immutable, versioned by tag/digest | Mutable while it runs (files written, ports bound), disposable |
| Lifecycle | Built (`docker build`), pulled/pushed from a registry | Created, started, stopped, removed (`docker run` / `stop` / `rm`) |
| Quantity | One image | Many containers can run from the same image |
| Analogy | A class / a program on disk | An object / a running process |

A container does not copy the image: it stacks a writable layer on top, which is why
starting one takes about a second. Deleting the container throws that layer away; the
image is untouched. Modifying the image (`docker commit` or a new build) is what
produces a new image.

## Question 3 - Size of the image vs a non-slim base image

Same application, same dependencies, three builds measured with `docker images`:

| Base image | Build | Size |
|---|---|---|
| `node:20-alpine` (slim) | `docker build -t devops-project:1.0 .` | **202 MB** |
| `node:20-alpine` (multi-stage) | `docker build -f Dockerfile.multistage ...` | **199 MB** |
| `node:20` (non-slim) | `docker build -t devops-project:1.0-full --build-arg BASE_IMAGE=node:20 .` | **1.58 GB** |

**What we observe.** The non-slim image is roughly **8x bigger** (about +1.38 GB,
i.e. the slim one is ~87% smaller). The extra weight is not our code - the
application layer is the same `node_modules` + two source files in both cases. It is
the full Debian userland of `node:20`: the build toolchain (`gcc`, `make`,
`python3`), `git`, the package manager caches, man pages, locales, and every tool
used to compile native modules.

Consequences:

- **Pull and start time.** A 202 MB image is pulled, pushed and cached far faster;
  in CI it is the difference between a few seconds and a few minutes per run.
- **Attack surface.** Every extra binary (compiler, git, shell utilities) is a
  potential CVE. The slim image ships less software to patch.
- **Cost.** Less storage in the registry, less bandwidth on every node of a cluster.

**Trade-off to keep in mind.** `alpine` uses **musl libc** instead of glibc. Pure
JavaScript dependencies (Express, here) are unaffected, but a native module
(`bcrypt`, `sharp`, `node-canvas`...) may need a musl build or must be compiled
inside the image. That is why the reduction is a decision to validate with the test
suite, not a free win.

**Bonus - multi-stage build.** `Dockerfile.multistage` installs the dependencies in
a `deps` stage, then copies only `node_modules` into a fresh `runtime` stage:
**199 MB vs 202 MB**, about 3 MB saved. Honest conclusion for *this* project: the gain
is small, because the image is pure JavaScript and `npm ci --omit=dev` already keeps
devDependencies out. The multi-stage pattern pays off as soon as a real build step
exists (TypeScript, webpack, `npm prune`, asset compilation): the compiler and the
devDependencies can stay in the build stage and never reach the runtime image, while
the final image is built from a clean base.

## Question 4 - Why tag the image with the commit SHA rather than `latest`?

- **Immutability.** A commit SHA never changes, so `myapp:9b21bd5` always refers to
  exactly the same bytes. `latest` is a moving pointer: the same tag can designate a
  different image tomorrow, and a cached `latest` on a node may be months old.
- **Traceability.** Commit -> pipeline run -> image becomes a one-way lookup:
  given a running container, the tag gives the commit, the diff and the PR. This is
  the lab requirement "commit -> pipeline run -> published image".
- **Rollback.** Deploying back to the previous version means deploying the previous
  SHA. With `latest` alone there is nothing to roll back to - you have to rebuild.
- **Cache and reproducibility.** Kubernetes/Docker will not re-pull `latest` unless
  told to (`imagePullPolicy: Always`), so different environments silently run
  different code. Immutable tags remove that class of "works in staging" bug.
- **Audit.** Every deployment can be mapped to an identified, reviewed, tested
  commit, which is exactly what an auditor or a postmortem needs.

`latest` is still convenient as an *additional* moving alias for humans, but it must
never be the only tag of an artifact promoted across environments.

## Question 5 - What does "fail fast" mean in a pipeline?

Fail fast means **stop at the first failing step instead of carrying a broken
artifact further down the chain**. The pipeline is a chain of gates (install ->
lint -> tests -> image build -> publish); the moment one gate is red, later steps are
skipped and the developer is told immediately.

Why it matters:

- **Short feedback loop.** The cheapest stages (lint, unit tests) run first and take
  seconds: the author learns about a mistake in minutes, not after a 40-minute build.
  That is the DORA "lead time for changes" in practice.
- **No broken artifact.** A failing test stops the `docker build`, and `publish` only
  runs on `main` after `build-test` (`needs: build-test`), so a red pipeline never
  produces an image in the registry. Nothing that failed can be deployed.
- **Blocked merge.** Because `build-test` is a required check, a red run physically
  blocks the Pull Request: the defect cannot reach `main`.
- **Saved resources.** CI minutes, registry storage and cluster bandwidth are not
  spent on an artifact that would be thrown away.

In code, the same principle is implemented by things like `set -e` in a shell script,
or an unhandled exception terminating the process instead of letting it continue in
an unknown state.
