---
"@rpch/sdk": minor
---

Rework node selection algorithm:
- query initial fixed amount of entry nodes (e.g. 10)
- open websockets to all, determine best connection
- close other connections
- use determined routes as long as feasible
- repeat

Resending requests on fallback route if possible:
- if request on preferred entry-exit combination does not work,
  we try resending it on the second best one
