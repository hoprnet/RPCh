# Create funding service

# use slim version of node on Debian bullseye for smaller image sizes
FROM node:16-bullseye-slim as builder

# use bash to have source command and persistent environment.
SHELL ["/bin/bash", "-lc"]

WORKDIR /app

# Install turbo to be able to use its commands.
RUN yarn global add turbo

# Copy app source
COPY . .

# Generate a partial monorepo with a pruned lockfile for the target workspace.
RUN turbo prune --scope="@rpch/manager" --docker

# Add lockfile and package.json's of isolated subworkspace.
FROM node:16-bullseye-slim AS installer
RUN apt-get update && \
  apt-get install -y libc6
WORKDIR /app

# Install the dependencies.
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/yarn.lock .yarn.lock
RUN yarn install

# Build the project.
COPY --from=builder /app/out/full .
COPY turbo.json turbo.json
RUN yarn run build --scope="@rpch/manager"

#  Copy only the necesary files to run the app.
FROM node:16-bullseye-slim AS runner
WORKDIR /app

# we use tini as process 1 to catch signals properly, which is also built into Docker by default
RUN apt-get update && \
  apt-get install -y tini curl && \
  rm -rf /var/lib/apt/lists/*

# this helper script can be used to ensure the hoprd node is running before starting
RUN  curl https://raw.githubusercontent.com/eficode/wait-for/v2.2.3/wait-for > /bin/wait-for \
  && chmod u+x /bin/wait-for

COPY --from=installer /app/devkit/manager/package.json .
COPY --from=installer /app .

CMD ["node", "devkit/manager/build/index.js"]
ENTRYPOINT ["/sbin/tini", "--"]