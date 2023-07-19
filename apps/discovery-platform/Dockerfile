# Create discovery platform

# use slim version of node on Debian bullseye for smaller image sizes
FROM node:18-bullseye-slim as builder

# use bash to have source command and persistent environment.
SHELL ["/bin/bash", "-lc"]

WORKDIR /app

# Install turbo to be able to use its commands.
RUN yarn global add turbo

# Copy app source
COPY . .

# Generate a partial monorepo with a pruned lockfile for the target workspace.
RUN turbo prune --scope="@rpch/discovery-platform" --docker

# Add lockfile and package.json's of isolated subworkspace.
FROM node:18-bullseye-slim AS installer
RUN apt-get update && \
  apt-get install -y libc6 && \
  rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install the dependencies.
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock ./yarn.lock
RUN yarn install --frozen-lockfile

# Build the project.
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="@rpch/discovery-platform"

#  Copy only the necesary files to run the app.
FROM node:18-bullseye-slim AS runner
WORKDIR /app

# we use tini as process 1 to catch signals properly, which is also built into Docker by default
RUN apt-get update && \
  apt-get install -y tini && \
  rm -rf /var/lib/apt/lists/*

COPY --from=installer /app/apps/discovery-platform/package.json .
COPY --from=installer /app .
COPY apps/discovery-platform/migrations/ /app/

# switch to normal user, to prevent dangerous root access
RUN chown -R node:node .

# finally set the non-root user so the process also run un-privilidged
USER node

CMD ["node", "apps/discovery-platform/build/index.js"]

ENTRYPOINT ["/usr/bin/tini", "--"]