FROM node:18-slim as node

WORKDIR /app/rpch
COPY tsconfig.json .
COPY devkit/loadtesting-k6 devkit/loadtesting-k6
WORKDIR /app/rpch/devkit/loadtesting-k6
RUN yarn install \
  && yarn build


# Build the k6 binary with the extension
FROM golang:1.20 as xk6

RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build --with github.com/grafana/xk6-output-prometheus-remote@latest --output /k6

FROM grafana/k6:latest

COPY --from=xk6 /k6 /usr/bin/k6
COPY --from=node /app/rpch/devkit/loadtesting-k6/build /app/rpch

WORKDIR /app/rpch

ENTRYPOINT [ "/app/rpch/k6"]