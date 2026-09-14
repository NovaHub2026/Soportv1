#!/usr/bin/env bash
# Gate-then-commit (GOVERNANCE.md §7.2, §9.2; Cycle Audit 1 FND-0028 / BL-020; Cycle Audit 2 FND-0040).
# The commit exists only if `npm run verify` exited 0 and no PLACEHOLDER token is left in the documentation.
# Usage: bash scripts/gate-commit.sh <message-file> [--no-push]
#   GATE_LOG=<path> overrides where the verify output is written (default .gate-verify.log, git-ignored).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MSG="${1:?usage: gate-commit.sh <message-file> [--no-push]}"
PUSH=1
if [[ "${2:-}" == "--no-push" ]]; then PUSH=0; fi
LOG="${GATE_LOG:-$ROOT/.gate-verify.log}"

if ! npm run verify > "$LOG" 2>&1; then
  echo "verify FAILED — nothing committed. Last lines of $LOG:"
  tail -40 "$LOG"
  exit 1
fi
echo "verify exit 0"
grep -E "check-context:|Tests  " "$LOG" || true

if grep -rlE '[A-Z0-9_]+_PLACEHOLDER' docs CURRENT_STATE.md SESSION_HANDOFF.md > /dev/null 2>&1; then
  echo "<NAME>_PLACEHOLDER tokens left — nothing committed:"
  grep -rlE '[A-Z0-9_]+_PLACEHOLDER' docs CURRENT_STATE.md SESSION_HANDOFF.md
  exit 1
fi

git add -A
git -c core.safecrlf=false commit -q -F "$MSG"
if [[ $PUSH -eq 1 ]]; then git push -q origin main; fi
git log --oneline -1
git status -sb | head -1
