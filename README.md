# context-guard

> Stop Claude Code from burning tokens on lockfiles, build output, and logs — and from reading your secrets.

`context-guard` is a [Claude Code](https://claude.com/claude-code) plugin that adds three layers of protection to every session:

1. **Bloat shield** — Claude can't read `node_modules/`, lockfiles, build artifacts, generated code, logs, sourcemaps, etc.
2. **Secret shield** — Claude can't read `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.json`, and similar secret files.
3. **Bash guard** — broad commands like `find .`, `ls -R`, `grep -R`, `tree`, `cat *.log`, `git log` (unbounded) are blocked with a concrete narrower alternative.

It also ships a `/context-guard:audit` slash command that scans your repo and recommends a tailored `.contextguardignore`.

No dependencies, no telemetry, no network. Pure Node.js stdlib.

---

## Install

From the Claude Code marketplace:

```
/plugin marketplace add canellik/claude-context-guard
/plugin install context-guard
```

That's it. The next time Claude tries to read `package-lock.json` or run `find .`, the guard kicks in.

---

## What gets blocked

### Bloat (default deny — readable via override)

`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `coverage/**`, `vendor/**`, `target/**`, `__pycache__/**`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `composer.lock`, `Gemfile.lock`, `poetry.lock`, `*.lock`, `*.log`, `*.min.js`, `*.min.css`, `*.map`, `**/generated/**`, `*.tsbuildinfo`, …

### Secrets (default deny — high-severity)

`.env`, `.env.*`, `*.pem`, `*.key`, `*.pfx`, `*.p12`, `id_rsa`, `id_ed25519`, `credentials.json`, `secrets.*`, `service-account*.json`, `.aws/credentials`, `.npmrc`, `.netrc`, …

### Broad bash commands (default deny + suggestion)

| Detected                           | Suggested rewrite                                  |
| ---------------------------------- | -------------------------------------------------- |
| `find .` (no `-maxdepth`)          | `find . -maxdepth 2 -type f -name "*.ts"`          |
| `ls -R`                            | `find . -maxdepth 2 -type d`                       |
| `grep -R` (no `--include`)         | `grep -R --include='*.ts' <pattern> src/`          |
| `tree` (no `-L`)                   | `tree -L 2`                                        |
| `cat *.log` / `cat lockfile`       | `tail -n 200 file.log`                             |
| `git log` (unbounded)              | `git log --oneline -n 30`                          |
| `npm ls`                           | `npm ls --depth=0`                                 |
| `du` (no `--max-depth`)            | `du -ah --max-depth=2 . \| sort -rh \| head -30`   |
| `find /`                           | `find . -maxdepth 3`                               |

### File size cap

Any single file over **500 KB** is blocked with a hint to use `head` / `tail` / `sed -n` / `grep`. Tunable.

---

## Configuration

Both files live at the **project root** and are optional.

### `.contextguardignore`

Gitignore-style allow-list. Anything listed here **bypasses** the deny rules.

```gitignore
# Let Claude read this one lockfile
package-lock.json

# Allow a specific generated file
src/generated/types.ts

# Bash overrides — prefix with bash:
bash:find . -maxdepth 6
```

### `.contextguardrc.json`

```json
{
  "maxFileSize": 512000,
  "bashGuard": "block",
  "disableReadGuard": false,
  "disableBashGuard": false,
  "extraDeny": ["data/**", "**/*.sqlite"],
  "extraSecrets": ["**/private-config.json"]
}
```

| Field              | Type                  | Default   | Notes                                                            |
| ------------------ | --------------------- | --------- | ---------------------------------------------------------------- |
| `maxFileSize`      | number (bytes)        | `512000`  | Max bytes for any single file read.                              |
| `bashGuard`        | `"block" \| "warn"`   | `"block"` | `"warn"` lets the command run but injects an advisory.           |
| `disableReadGuard` | boolean               | `false`   | Turn off all file-read protection.                               |
| `disableBashGuard` | boolean               | `false`   | Turn off bash protection.                                        |
| `extraDeny`        | string[] (glob)       | `[]`      | Extra bloat patterns.                                            |
| `extraSecrets`     | string[] (glob)       | `[]`      | Extra secret patterns (treated as HIGH severity).                |

---

## `/context-guard:audit`

Run this in any project:

```
/context-guard:audit
```

You'll get a markdown report:

```
### High-risk files
- src/generated/api-client.ts — 1.2 MB — generated
- logs/app.log — 4.2 MB — log
- package-lock.json — 1.4 MB — lockfile

### Detected secrets
- .env.local — HIGH

### Recommended .contextguardignore additions
src/generated/**
logs/**
```

Then it offers to write the `.contextguardignore` for you.

---

## How it works

Two `PreToolUse` hooks defined in [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json):

- **Read guard** — matches `Read|Edit|Write|NotebookEdit|Glob|Grep`, inspects `tool_input.file_path`, denies based on pattern + size.
- **Bash guard** — matches `Bash`, runs regex rules from [`lib/bash-rewriter.js`](lib/bash-rewriter.js), denies (or warns) with a rewrite suggestion.

Both hooks emit Claude Code's standard `hookSpecificOutput.permissionDecision` JSON shape, which surfaces the reason directly to Claude so it can adapt instead of giving up.

---

## Development

```bash
git clone https://github.com/canellik/claude-context-guard
cd claude-context-guard

# Test a hook locally:
echo '{"tool_name":"Read","tool_input":{"file_path":"package-lock.json"},"cwd":"'"$PWD"'"}' \
  | node hooks/pretool-read-guard.js

echo '{"tool_name":"Bash","tool_input":{"command":"find ."},"cwd":"'"$PWD"'"}' \
  | node hooks/pretool-bash-guard.js
```

Install the plugin from a local path during development:

```
/plugin marketplace add /absolute/path/to/claude-context-guard
/plugin install context-guard
```

---

## License

MIT — see [LICENSE](LICENSE).

Issues and PRs welcome at <https://github.com/canellik/claude-context-guard>.
