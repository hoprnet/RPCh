.POSIX:

version != jq --raw-output '.version' package.json

all: help

docker-build: ## build Docker image
	docker build .

docker-publish: ## build and publish Docker image
	docker build . -t gcr.io/hoprassociation/hopr-rpc-relay:v${version}
	docker push gcr.io/hoprassociation/hopr-rpc-relay:v${version}

docker-tag-latest: ## tag particular Docker image with latest tag, requires tag=
ifeq ($(tag),)
	echo "parameter <tag> missing"
	exit 1
endif
	docker tag gcr.io/hoprassociation/hopr-rpc-relay:$(tag) \
	  gcr.io/hoprassociation/hopr-rpc-relay:latest
	docker push gcr.io/hoprassociation/hopr-rpc-relay:latest

devkit-run: ## run local docker-compose based RPCh devkit
	cd devkit && docker-compose pull
	docker-compose -p hopr-rpc-relay-devkit -f devkit/docker-compose.yml \
		up --build --abort-on-container-exit --remove-orphans

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
