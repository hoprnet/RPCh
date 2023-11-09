# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:18-alpine as builder

RUN apk upgrade --no-cache

WORKDIR /app

# Install turbo to be able to use its commands.
RUN yarn global add turbo

# Copy app source
COPY . .

# Generate a partial monorepo with a pruned lockfile for the target workspace.
RUN turbo prune --scope="@rpch/exit-node" --docker

# Add lockfile and package.json's of isolated subworkspace.
# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:18-alpine as installer

WORKDIR /app

# Install the dependencies.
COPY .gitignore .gitignore
COPY packages-tgz packages-tgz
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock ./yarn.lock
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN yarn install --frozen-lockfile

# Build the project.
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="@rpch/exit-node"

# prepare for production
RUN rm -R node_modules && \
    yarn config set nmMode hardlinks-local && \
    yarn install --production --frozen-lockfile && \
    rm -rf node_modules/ethers/dist node_modules/protobufjs/cli

# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 alpine:3 as runner

ENV LOGGER=false

WORKDIR /app

RUN apk upgrade --no-cache && \
    apk add --no-cache nodejs tini && \
    addgroup -g 104 -S node && \
    adduser -u 104 -D -S -G node node

# copy over minimal fileset to run availability-monitor
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/package.json .
COPY --from=installer /app/apps/exit-node/build ./build
COPY --from=installer /app/packages/sdk ./packages/sdk
COPY --from=installer /app/packages/compat-crypto ./packages/compat-crypto

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "build/index.js"]
