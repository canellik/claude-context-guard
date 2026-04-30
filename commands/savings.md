---
description: Show how many tokens context-guard has saved across all sessions
allowed-tools: Bash
---

Run the savings report and print its output **verbatim** — do not summarize, paraphrase, or add commentary.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/savings-report.js" $ARGUMENTS
```

Supported flags (pass them after `/context-guard:savings`):

- `--project <name>` — filter to a specific repo (uses the directory name)
- `--since <Nd|Nh|Nw>` — only count events newer than this window (e.g. `--since 7d`)

If the report says "no events yet", it just means context-guard hasn't blocked anything since you installed it. Try reading `package-lock.json` or running `find .` to generate a real entry.
