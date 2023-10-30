FROM --platform=linux/amd64 node:18-alpine as builder

RUN apk upgrade --no-cache

WORKDIR /app

# Install turbo to be able to use its commands.
RUN yarn global add turbo

# Copy app source
COPY . .

# Generate a partial monorepo with a pruned lockfile for the target workspace.
RUN turbo prune --scope="@rpch/rpc-server" --docker

# Add lockfile and package.json's of isolated subworkspace.
# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:18-alpine as installer

WORKDIR /app

# Install the dependencies.
COPY .gitignore .gitignore
COPY packages-tgz packages-tgz
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock ./yarn.lock
RUN apk add --no-cache python3 make g++ && \
    yarn install --frozen-lockfile

# Build the project.
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="@rpch/rpc-server"

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
    apk add --no-cache curl nodejs haproxy && \
    curl -L -o /tmp/install-runit.sh https://raw.githubusercontent.com/docker-suite/Install-Scripts/master/alpine-runit/install-runit.sh && \
    sh /tmp/install-runit.sh && \
    rm /tmp/install-runit.sh && \
    curl -L -o /usr/bin/mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 && \
    chmod +x /usr/bin/mkcert && \
    mkdir -p /etc/certs && \
    addgroup -g 103 -S www && \
    adduser -u 103 -D -S -G www www && \
    addgroup -g 104 -S node && \
    adduser -u 104 -D -S -G node node && \
    chown -R www:www /etc/certs

# copy over minimal fileset to run rpc-server
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/package.json .
COPY --from=installer /app/apps/rpc-server/build/*.js .
COPY --from=installer /app/packages/sdk ./packages/sdk
COPY --from=installer /app/packages/compat-crypto ./packages/compat-crypto

# copy over runit configurations
COPY apps/rpc-server/docker_files/haproxy.conf /etc/haproxy/haproxy.conf
COPY apps/rpc-server/docker_files/service.d /etc/service.d
COPY apps/rpc-server/docker_files/entrypoint.sh /

ENTRYPOINT ["/entrypoint.sh"]

CMD ["start"]
