#!/usr/bin/env bash
# Gate-then-commit (GOVERNANCE.md §7.2, §9.1, §9.2; Cycle Audit 1 FND-0028 / BL-020; Cycle Audit 2 FND-0040).
# The commit exists only if `npm run verify` exited 0, the tree did not change while it ran, and no
# <NAME>_PLACEHOLDER token is left in the documentation. It stages only what it should (Cycle Audit 3): changes
# to tracked files, plus untracked paths named with --include; any other untracked file stops the gate, so probe
# scripts or stray exports never slip into a commit (§9.1, §11).
# Usage: bash scripts/gate-commit.sh <message-file> [--no-push] [--include <path>]...
#   GATE_LOG=<path> overrides where the verify output is written (default .gate-verify.log, git-ignored).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MSG="${1:?usage: gate-commit.sh <message-file> [--no-push] [--include <path>]...}"
shift
PUSH=1
INCLUDE=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=0; shift ;;
    --include) INCLUDE+=("${2:?--include needs a path}"); shift 2 ;;
    *) echo "unknown argument: $1"; exit 2 ;;
  esac
done
LOG="${GATE_LOG:-$ROOT/.gate-verify.log}"

stray=""
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  named=0
  for inc in "${INCLUDE[@]+"${INCLUDE[@]}"}"; do
    if [[ "$file" == "$inc" || "$file" == "${inc%/}/"* ]]; then named=1; fi
  done
  if [[ $named -eq 0 ]]; then stray+="  $file"$'\n'; fi
done <<< "$(git ls-files --others --exclude-standard)"
if [[ -n "$stray" ]]; then
  echo "Untracked files not named with --include — nothing committed:"
  printf '%s' "$stray"
  exit 1
fi

before="$(git status --porcelain=v1 -uall | sha1sum)"
if ! npm run verify > "$LOG" 2>&1; then
  echo "verify FAILED — nothing committed. Last lines of $LOG:"
  tail -40 "$LOG"
  exit 1
fi
echo "verify exit 0"
grep -E "check-context:|Tests  " "$LOG" || true
after="$(git status --porcelain=v1 -uall | sha1sum)"
if [[ "$before" != "$after" ]]; then
  echo "The working tree changed while verify ran — nothing committed. Re-run the gate."
  exit 1
fi

if grep -rlE '[A-Z0-9_]+_PLACEHOLDER' docs CURRENT_STATE.md SESSION_HANDOFF.md > /dev/null 2>&1; then
  echo "<NAME>_PLACEHOLDER tokens left — nothing committed:"
  grep -rlE '[A-Z0-9_]+_PLACEHOLDER' docs CURRENT_STATE.md SESSION_HANDOFF.md
  exit 1
fi

git add -u
for inc in "${INCLUDE[@]+"${INCLUDE[@]}"}"; do git add -- "$inc"; done
git -c core.safecrlf=false commit -q -F "$MSG"
if [[ $PUSH -eq 1 ]]; then git push -q; fi
git log --oneline -1
git status -sb | head -1
