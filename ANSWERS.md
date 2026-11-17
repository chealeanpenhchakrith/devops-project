# Lab 1 - Answers to Questions 1 to 5

## Question 1 - Why forbid direct pushes to main?

Requiring Pull Requests lets the team review changes and run automated checks before
merging them into main. This reduces the risk of breaking the shared application
and keeps the discussion and validation linked to each change. Reviews and CI checks
must be configured as required in the branch protection settings to enforce them.

## Question 2 - What is the difference between an image and a container?

An image is a read-only template containing the application, its dependencies and
its runtime configuration. A container is an instance created from that image, with
its own writable layer; it can be running or stopped. Several containers can use
the same image. Removing a container does not remove its image.

## Question 3 - Compare the image size with a non-slim base image

The sizes previously recorded for this project are:

| Variant | Base image | Recorded size |
|---|---|---|
| Lightweight single-stage | node:20-alpine | 202 MB |
| Lightweight multi-stage | node:20-alpine | 199 MB |
| Full single-stage | node:20 | 1.58 GB |

3.2
![img.png](img.png)

3.3
![img_1.png](img_1.png)

The Alpine-based image is about 87% smaller than the full image. Its base contains
fewer system packages and tools, which reduces storage and transfer requirements.
Alpine is a separate lightweight variant, rather than the official node:20-slim tag.
These sizes depend on the image versions, platform and measurement method.

Bonus: the multi-stage build saves about 3 MB in the recorded comparison. The gain
is small because the single-stage Dockerfile already installs only production
dependencies. Multi-stage builds are especially useful when compilation tools or
other build dependencies can be excluded from the final image.

## Question 4 - Why tag the image with the commit SHA rather than latest?

A commit SHA tag links the image to a specific source revision. It makes it easier
to trace a version through its commit, pipeline run and published image, and to
select a previous version for rollback. In contrast, latest can point to a different
version after each publication.

A SHA-based tag is still a Docker tag and can be overwritten. An image digest
(sha256:...) identifies the exact image content; rebuilding the same commit can
produce a different image if its base image or other build inputs change.

## Question 5 - What does fail fast mean in a pipeline?

Fail fast means reporting a failure as early as possible and skipping subsequent
steps that depend on its success. Cheap checks such as lint and tests run before
more expensive operations such as building and publishing an image.

In this workflow, a failing test prevents the Build image step from running, and
the publish job is skipped because it needs build-test to succeed. A failing check
also blocks merging when Build and test is configured as a required status check
on main.
