# Discovery platform

For the RPCh SDK to be usable, it needs to know which HOPRd entry nodes and HOPRd exit nodes it can use. The discovery platform requires participants in the RPCh network to be registered, that way, it can provide the RPCh SDK with a list of participants.
Additionally, the discovery platform maintains an honesty score which may exclude a registered node if proven to be dishonest, ensuring that clients which use the RPCh SDK have reliable connections to the RPCh network.
Lastly, when a new node is registered in the discovery platform, the discovery platform is responsible for funding the nodes.

## Run with Docker

To be able to run the funding platform with Docker, you first need to build the image, for that, we will use the following command

```sh
docker build -t discovery-platform -f Dockerfile ../../
```

After building the image, you will be able to run it with: \
(replace the values that have `< >`)

```sh
docker run \
-e FUNDING_SERVICE_URL="<YOUR FUNDING SERVICE URL>" \
-e HOPRD_ACCESS_TOKEN="<YOUR HOPRD ACCESS TOKEN>" \
-e DB_CONNECTION_URL="<YOUR DB CONNECTION URL>" \
-e DEBUG="rpch*,-*verbose,-*metrics" \
discovery-platform
```
