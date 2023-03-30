# Create exit node container

# use slim version of node on Debian bullseye for smaller image sizes
# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:16-bullseye-slim as builder

# use bash to have source command and persistent environment.
SHELL ["/bin/bash", "-lc"]

# python is used by some nodejs dependencies as an installation requirement.
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

# Install turbo to be able to use its commands.
RUN yarn global add turbo

# Copy app source
COPY . .

# Generate a partial monorepo with a pruned lockfile for the target workspace.
RUN turbo prune --scope="@rpch/exit-node" --docker

# Add lockfile and package.json's of isolated subworkspace.
# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:16-bullseye-slim AS installer
RUN apt-get update && \
  apt-get install -y libc6 && \
  rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install the dependencies.
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock .yarn.lock
RUN yarn install

# Build the project.
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="@rpch/exit-node"

#  Copy only the necesary files to run the app.
# Specify platform to be amd because arm doesn't work
FROM --platform=linux/amd64 node:16-bullseye-slim AS runner

WORKDIR /app

RUN mkdir -p /app/db
# set volume which can be mapped by users on the host system
VOLUME ["/app/db"]

# we use tini as process 1 to catch signals properly, which is also built into Docker by default
RUN apt-get update && \
  apt-get install -y tini curl wget netcat && \
  rm -rf /var/lib/apt/lists/*

# this helper script can be used to ensure the hoprd node is running before starting
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh > /bin/wait-for-it.sh \
  && chmod o+x /bin/wait-for-it.sh \
  && chmod u+x /bin/wait-for-it.sh

COPY --from=installer /app/apps/exit-node/package.json .
COPY --from=installer /app .

# switch to normal user, to prevent dangerous root access
RUN chown -R node:node .

# finally set the non-root user so the process also run un-privilidged
USER node

CMD ["node", "apps/exit-node/build/index.js"]

ENTRYPOINT ["/usr/bin/tini", "--"]