---
'@rpch/sdk': major
---

Changes SDK send function return response.
No longer offers async resolvers for json and text.
Response contains attributes for server status, statusCode and headers.
Text property can now be used to parse as JSON.
