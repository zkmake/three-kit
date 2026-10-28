---
"@zkmake/three-audit": patch
"@zkmake/three-studio": patch
---

The `bin` path is written `dist/cli.js`, as npm stores it, so publishing no longer warns that it corrected package.json. The command installs as before.
