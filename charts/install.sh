#!/bin/bash

helm upgrade --install pluto pluto --namespace pluto --create-namespace

helm upgrade --install exit-node-1 exit-node --namespace exit-node --create-namespace --set HOPRD_API_ENDPOINT=http://pluto.pluto:13301
helm upgrade --install exit-node-2 exit-node --namespace exit-node --create-namespace --set HOPRD_API_ENDPOINT=http://pluto.pluto:13302
helm upgrade --install exit-node-3 exit-node --namespace exit-node --create-namespace --set HOPRD_API_ENDPOINT=http://pluto.pluto:13303
helm upgrade --install exit-node-4 exit-node --namespace exit-node --create-namespace --set HOPRD_API_ENDPOINT=http://pluto.pluto:13304
helm upgrade --install exit-node-5 exit-node --namespace exit-node --create-namespace --set HOPRD_API_ENDPOINT=http://pluto.pluto:13305

helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade postgresql bitnami/postgresql \
  --install \
  --namespace postgresql \
  --create-namespace \
  --set global.postgresql.auth.postgresPassword="postgresql" \
  --set global.postgresql.auth.username="postgresql" \
  --set global.postgresql.auth.password="postgresql" \
  --set global.postgresql.auth.database="postgresql"

helm upgrade --install funding-service funding-service --namespace funding-service --create-namespace
helm upgrade --install discovery-platform discovery-platform --namespace discovery-platform --create-namespace