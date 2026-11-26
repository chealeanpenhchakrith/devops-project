# devops-project

Minimal Node.js API used for **ST2DCE - DevOps and Continuous Deployment, Lab 1**
(Git workflow, Docker, GitHub Actions CI, image published to GHCR).

The service exposes:

| Route     | Answer                                        |
|-----------|-----------------------------------------------|
| `GET /`   | `200` + `Hello World from version 2` |
| `GET /health` | `200` + `OK` (plain text)                 |
| `GET /metrics` | Prometheus metrics for the process and HTTP requests |
| `GET /slow` | Waits for a random duration up to 2 seconds |
| `GET /error` | Returns HTTP 500 about 30% of the time |

## Stack

- Node.js 20+ / Express 5 (ES modules)
- Tests: `node:test` + `supertest` (no test framework to install)
- Lint: ESLint 9, flat config
- Container: `node:20-alpine`, non-root user `node`, port 3000
- CI/CD: GitHub Actions, image published to GitHub Container Registry

## Layout

```
app.js                      Express application (exported, testable)
server.js                   HTTP listener + graceful shutdown
test/health.test.js         Route tests
eslint.config.js            Lint configuration
Dockerfile                  Single-stage image (step 2.1)
Dockerfile.multistage       Multi-stage image (Bonus)
.github/workflows/ci.yml    Build, test, publish pipeline
ANSWERS.md                  Answers to the five lab questions
```

## Run locally

```bash
npm ci
npm test          # 3 tests
npm run lint
npm start         # http://localhost:3000
```

For Lab 4 Part 1, generate traffic and inspect the metrics endpoint:

```bash
curl http://localhost:3000/
curl http://localhost:3000/slow
curl http://localhost:3000/error
curl http://localhost:3000/metrics
```

HTTP request metrics use the normalized Express route as a label, so dynamic URL
values do not create unbounded Prometheus time series. Request logs are emitted as
JSON to stdout for container log collection. The existing GitHub Actions workflow
builds images tagged with the commit SHA and publishes them to GHCR on `main`.

## Run with Docker

```bash
docker build -t devops-project:1.0 .
docker run -d -p 3000:3000 --name myapp devops-project:1.0
curl http://localhost:3000/health
docker logs myapp
docker exec -it myapp sh
```

The image runs as the unprivileged `node` user:

```bash
docker exec myapp whoami    # node
```

## Image variants and sizes

Measured with `docker images` on the same machine, same application code:

| Variant | Build command | Size |
|---|---|---|
| Slim single-stage | `docker build -t devops-project:1.0 .` | **202 MB** |
| Slim multi-stage (Bonus) | `docker build -f Dockerfile.multistage -t devops-project:1.0-multistage .` | **199 MB** |
| Non-slim single-stage | `docker build -t devops-project:1.0-full --build-arg BASE_IMAGE=node:20 .` | **1.58 GB** |

The `node:20-alpine` base is about 87% smaller than the full `node:20` image: the
difference is the complete Debian userland, the build toolchain and the npm cache,
none of which is needed at runtime.

## CI pipeline

`.github/workflows/ci.yml` runs on every pull request and on every push to `main`.

`build-test` job:

1. `actions/checkout@v4`
2. `npm ci` - reproducible install from `package-lock.json`
3. `npm run lint`
4. `npm test`
5. `docker build -t myapp:<commit-sha> .`

`publish` job (only on `main`, after `build-test`):

1. login to `ghcr.io` with `${{ secrets.GITHUB_TOKEN }}` (never a hard-coded password)
2. `docker/build-push-action@v5` pushing `ghcr.io/<owner>/<repo>:<commit-sha>`

## Protected `main`

`main` must stay releasable, so it is protected by two GitHub rules
(*Settings -> Branches*, pattern `main`):

1. **Require a pull request before merging** - no direct push to `main`;
   **2 approvals** are required and approvals are dismissed when new commits land.
2. **Require status checks to pass** - the `Build and test` job is required, so a red
   pipeline blocks the merge button.

With two approvals on a team of three or four, at least two teammates must read the
diff before anything reaches `main`; the author counts as a reviewer for nobody.

> Only an administrator of the repository can change these rules (GitHub answers `404`
> to everybody else, which is why this file documents them instead of asserting them
> from CI). The check is listed as `Build and test` in the branch protection picker.

The resulting flow is: branch -> commit -> push -> Pull Request -> automated
CI + review -> merge -> `publish` job -> image in GHCR tagged with the commit SHA.

## Traceability

One commit SHA identifies the whole chain:

```
commit 4b4ba17  ->  CI run #4  ->  ghcr.io/chealeanpenhchakrith/devops-project:4b4ba17...
```

The image published from `main` is:

```
ghcr.io/chealeanpenhchakrith/devops-project:4b4ba17256b5a6f5f31c86f77a1e514d7b485266
```

Because the repository is private, the package is private too: `docker pull` requires
an account that has access to it and a token with the `read:packages` scope.

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <github-user> --password-stdin
docker pull ghcr.io/chealeanpenhchakrith/devops-project:4b4ba17256b5a6f5f31c86f77a1e514d7b485266
```

## Lab evidence

| Evidence | Link |
|---|---|
| Failing pipeline (test broken on purpose, `Build image` and `publish` skipped) | https://github.com/chealeanpenhchakrith/devops-project/actions/runs/44053350956 |
| Passing pipeline on the pull request | https://github.com/chealeanpenhchakrith/devops-project/actions/runs/44053249163 |
| Passing pipeline on `main` (build-test + publish to GHCR) | https://github.com/chealeanpenhchakrith/devops-project/actions/runs/44053709282 |
| Pull Request that delivered this work | https://github.com/chealeanpenhchakrith/devops-project/pull/2 |
| Published image | https://github.com/chealeanpenhchakrith/devops-project/pkgs/container/devops-project |
