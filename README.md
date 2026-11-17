# devops-project

Minimal Node.js API used for **ST2DCE - DevOps and Continuous Deployment, Lab 1**
(Git workflow, Docker, GitHub Actions CI, image published to GHCR).

The service exposes:

| Route     | Answer                                        |
|-----------|-----------------------------------------------|
| `GET /`   | `200` + `{"service":"devops-project","version":"1.0.0"}` |
| `GET /health` | `200` + `OK` (plain text)                 |

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

`main` must stay releasable, so two GitHub rules are expected on it
(*Settings -> Rules / Branches*):

1. **Require a pull request before merging** - no direct push to `main`.
2. **Require status checks to pass** - the `build-test` job is required, so a red
   pipeline blocks the merge button.

The resulting flow is: branch -> commit -> push -> Pull Request -> automated
CI + review -> merge -> `publish` job -> image in GHCR tagged with the commit SHA.

## Traceability

One commit SHA identifies the whole chain:

```
commit 695de3f  ->  CI run  ->  ghcr.io/chealeanpenhchakrith/devops-project:695de3f...
```

`docker pull ghcr.io/chealeanpenhchakrith/devops-project:<commit-sha>` reproduces
exactly the image built from that commit.
