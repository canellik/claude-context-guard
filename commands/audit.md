---
description: Scan the repo for high-risk files and recommend deny patterns for context-guard
allowed-tools: Bash, Read, Write
---

You are running the **context-guard audit**. Goal: identify files that waste Claude's context window or expose secrets, and propose a `.contextguardignore` for this repo.

## Steps

1. **Find the largest files in the repo (depth-bounded):**

   ```bash
   { du -ah --max-depth=4 . 2>/dev/null \
     | grep -Ev '/\.git/|/node_modules/' \
     | sort -rh \
     | head -50; } || true
   ```

2. **List likely-secret files:**

   ```bash
   find . -maxdepth 6 -type f \( \
     -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' \
     -o -name '*.pfx' -o -name 'id_rsa' -o -name 'id_ed25519' \
     -o -name 'credentials.json' -o -name 'secrets.*' \
     -o -name 'service-account*.json' \
     \) 2>/dev/null | grep -v '/node_modules/' || true
   ```

3. **Detect generated / lockfile / build noise:**

   ```bash
   find . -maxdepth 6 -type f \( \
     -name 'package-lock.json' -o -name 'yarn.lock' -o -name 'pnpm-lock.yaml' \
     -o -name 'Cargo.lock' -o -name 'composer.lock' -o -name 'Gemfile.lock' \
     -o -name 'poetry.lock' -o -name '*.min.js' -o -name '*.map' \
     -o -name '*.tsbuildinfo' -o -name '*.log' \
     \) 2>/dev/null | grep -Ev '/node_modules/|/\.git/' | head -40 || true
   ```

4. **Summarize as markdown** with these sections, in this order:

   ### High-risk files
   Top files >100 KB by size. For each: `path — size — reason (lockfile / generated / log / build artifact / other)`.

   ### Detected secrets
   Files matching secret patterns. Mark each as **HIGH** severity. If none, say "None detected."

   ### Recommended `.contextguardignore` additions
   A fenced code block with one pattern per line, ordered most-impactful first. Only include patterns that are actually present in this repo. Use gitignore syntax. Examples:
   ```
   src/generated/**
   logs/**
   docs/build/**
   ```

   ### Recommended `.contextguardrc.json` tweaks
   Suggest a `maxFileSize` if there are many borderline (200–500 KB) files that should still be readable. Otherwise omit this section.

5. **Offer to write the file:** Ask the user "Want me to write this to `.contextguardignore`?" Only call the Write tool if they agree.

## Style

- Be concise. No preamble, no recap of what context-guard does.
- Show real paths and real sizes from the commands above — never invent.
- If a command returns nothing, say so explicitly rather than fabricating results.
