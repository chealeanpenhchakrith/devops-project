# Lab 1 / step 2.1 - single-stage image
# lightweight base image, non-root user, explicit port
#
# BASE_IMAGE exists only to make Question 3 reproducible:
#   docker build -t myapp:1.0-full --build-arg BASE_IMAGE=node:20 .
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE}

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first: this layer stays cached while only the source changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application code last
COPY app.js server.js ./

EXPOSE 3000

# Never run the process as root
USER node

CMD ["node", "server.js"]
