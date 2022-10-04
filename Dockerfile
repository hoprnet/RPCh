# Run RPCh within a single container

# use slim version of node on Debian bullseye for smaller image sizes
FROM node:16-bullseye-slim@sha256:8265ac132f720998222008355e11535caf53d6bccecbb562a055605138975b4e as build

# use bash to have source command and persistent environment
SHELL ["/bin/bash", "-lc"]

# python is used by some nodejs dependencies as an installation requirement
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     git \
     python3 \
     unzip \
     curl \
     build-essential \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false

# making sure some standard environment variables are set for production use
ENV NEXT_TELEMETRY_DISABLED 1
ENV npm_config_build_from_source false

WORKDIR /app

COPY . /app

# install dev dependencies and build the app
RUN  yarn install \
  && yarn run clean \
  && yarn run build

# install production dependencies only to save space
RUN  rm -rf node_modules \
  && NODE_ENV=production yarn install

# use alpine version of node for smallest image sizes
FROM node:16-alpine as runtime

# making sure some standard environment variables are set for production use
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# we use tini as process 1 to catch signals properly, which is also built into Docker by default
RUN apk add --no-cache tini

WORKDIR /app

# copy over built artifacts
COPY --from=build /app/ .

# allow configuration of environment variabls as build arg or runtime env
ARG ENTRY_PORT
ARG HOPRD_API_ENDPOINT
ARG HOPRD_API_TOKEN

# set entry port to default 8080
ENV ENTRY_PORT=${ENTRY_PORT:-8080}
ENV HOPRD_API_ENDPOINT=${HOPRD_API_ENDPOINT:-}
ENV HOPRD_API_TOKEN=${HOPRD_API_TOKEN:-}

ENTRYPOINT ["/sbin/tini", "--", "yarn", "run", "start"]
