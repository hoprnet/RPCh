# Create exit node container

FROM node:16-bullseye-slim@sha256:2e42e0aab9c9fd2d914417659ebedb4f995dfde79f3f7127cbc7e57ae6485dd9 as builder
# FROM node:16-alpine as builder

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

# # Making sure some standard enviroment variables are set for production use
# ENV NEXT_TELEMETRY_DISABLE 1
# ENV npm_config_build_from_source false

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
RUN yarn run build --filter="rpch-exit-node"

FROM node:16-alpine AS runner
WORKDIR /app

COPY --from=installer /app/apps/exit-node/package.json .
COPY --from=installer /app .

# Allow configuration of enviroment variables as build arg or runtime env
ARG HOPRD_API_ENDPOINT
ARG HOPR_API_TOKEN

ENV HOPRD_API_ENDPOINT=${HOPR_API_TOKEN:-"https://zero_indus_callisto_white.playground.hoprnet.org:3001"}
ENV HOPR_API_TOKEN=${HOPR_API_TOKEN:-"67Daeb8DA13Dd72dcfE01Dcc#"}

CMD node apps/exit-node/build/index.js

# COPY packages/common /app/packages/common
# COPY --from=build_common /app/packages/common .
# COPY configs /app/configs

# Install dev dependencies and build the app
# RUN yarn add rpch-commons
# RUN yarn install \
#   && yarn run clean \
#   && yarn build

# RUN rm -rf node_modules \
#   && NODE_ENV=production yarn install


# FROM node:16-alpine as runtime

# # Making sure some standard enviroment variables are set for production use
# ENV NODE_ENV production
# ENV NEXT_TELEMETRY_DISABLE 1

# # We use tini as process 1 to catch signals properly, which is also built into Docker by default
# RUN apk add --no-cache tini curl

# # This helper script can be used to ensure the hoprd node is running before starting
# RUN curl https://raw.githubusercontent.com/eficode/wait-for/v2.2.3/wait-for > /bin/wait-for \
#   && chmod u+x /bin/wait-for


# WORKDIR /app

# # copy over built artifacts
# COPY --from=build /app/ .

# # Allow configuration of enviroment variables as build arg or runtime env
# ARG HOPRD_API_ENDPOINT
# ARG HOPR_API_TOKEN

# ENV HOPRD_API_ENDPOINT=${HOPR_API_TOKEN:-}
# ENV HOPR_API_TOKEN=${HOPR_API_TOKEN:-}

# CMD ["yarn", "run", "start"]

# ENTRYPOINT [ "/sbin/tini", "--" ]