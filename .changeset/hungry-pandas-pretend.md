---
"@rpch/sdk": minor
---

Implemented new algorithm enabled by api v3.
The SDK no longer needs a websocket connection.
It will ping entry nodes that are received from the DP
for best initial route and keep tracking those entry exit pairs for perfomance.
