# Create exit node container

FROM node:16-bullseye-slim@sha256:2e42e0aab9c9fd2d914417659ebedb4f995dfde79f3f7127cbc7e57ae6485dd9 as builder

SHELL ["/bin/bash", "-lc"]

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  git \
  python3 \
  unzip \
  curl \
  build-essential \
  ca-certificates \
  && rm -rf  /var/lib/apt/lists/* \
  && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false

WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune --scope="rpch-exit-node" --docker

FROM node:16-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app
RUN ls
# Install the dependencies
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock .yarn.lock
RUN yarn install

# Build the project
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="rpch-exit-node"

FROM node:16-alpine AS runner
WORKDIR /app

COPY --from=installer /app/apps/exit-node/package.json .
COPY --from=installer /app .

# Allow configuration of enviroment variables as build arg or runtime env
ARG HOPRD_API_ENDPOINT
ARG HOPR_API_TOKEN

ENV HOPRD_API_ENDPOINT=${HOPR_API_TOKEN:-"https://one_moon_godavari_black.playground.hoprnet.org:3001"}
ENV HOPRD_API_TOKEN=${HOPR_API_TOKEN:-"2eE90CE00FfE7#6701d2#852"}
ENV DEBUG="rpch*"

CMD node apps/exit-node/build/index.js