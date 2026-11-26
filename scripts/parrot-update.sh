#!/bin/bash
# AUGIE CONTROLLED UPDATE — the one fixed path by which the Parrot's
# Augie build changes (Part 22). Installed as ~/augie-app/update.sh.
#
# What it does, in order, logging every step with a timestamp to
# ~/.local/share/augie/update-run.log:
#   1. Clone the repo fresh (depth 1) into a temp dir.
#   2. Sync the tree into ~/augie-app (the operator's .env.server and
#      node_modules are never touched by the sync).
#   3. Stamp .augie-version with the cloned HEAD.
#   4. Rebuild with Node 22 + the node-server preset.
#   5. Restart augie.service and health-check the local port.
# Any failure stops the run, logs the step that failed, and leaves
# the previous build's .output in place (the sync never deletes it;
# a failed build does not replace a working one because the build
# writes .output only on success — and the service restarts only
# after a successful build).
set -u
LOG="$HOME/.local/share/augie/update-run.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "=== update started $(date -Is) ==="

fail() { echo "UPDATE FAILED at step: $1 ($(date -Is))"; exit 1; }

TMP="$(mktemp -d)" || fail "mktemp"
git clone --depth 1 https://github.com/blackvaultllc/AUGIXVI.git "$TMP/repo" || fail "clone"
HEAD_SHA="$(git -C "$TMP/repo" rev-parse HEAD)" || fail "rev-parse"
echo "target: $HEAD_SHA"

rsync -a --exclude node_modules --exclude .output --exclude .git --exclude .env.server \
  "$TMP/repo/" "$HOME/augie-app/" || fail "sync"
echo "$HEAD_SHA" > "$HOME/augie-app/.augie-version"

cd "$HOME/augie-app" || fail "cd"
export PATH="$HOME/.local/node22/bin:$PATH"
NITRO_PRESET=node-server npm run build || fail "build"

# Stage the device senders (tools/device-senders/ in the repo) into
# ~/augie-tools/, checksum-verified file by file: a staged sender
# whose hash differs from the repo copy fails the update here,
# before the restart — the bridge runs only what the repo shipped.
if [ -d "$HOME/augie-app/tools/device-senders" ]; then
  mkdir -p "$HOME/augie-tools"
  rsync -a "$HOME/augie-app/tools/device-senders/" "$HOME/augie-tools/" || fail "sender-stage"
  while IFS= read -r -d '' staged_src; do
    rel="${staged_src#"$HOME/augie-app/tools/device-senders/"}"
    src_hash="$(sha256sum "$staged_src" | cut -d' ' -f1)"
    dst_hash="$(sha256sum "$HOME/augie-tools/$rel" | cut -d' ' -f1)"
    [ "$src_hash" = "$dst_hash" ] || fail "sender-checksum $rel"
    chmod +x "$HOME/augie-tools/$rel" 2>/dev/null || true
    echo "sender staged + verified: $rel ($src_hash)"
  done < <(find "$HOME/augie-app/tools/device-senders" -type f -print0)
fi

# Stage the Go Drive seal checker (tools/go-drive/ in the repo)
# into ~/augie-tools/ the same way — checksum-verified — so the
# Captain's seal checks run the exact tool the repo shipped
# (cybernetic pass, 2026-11-26).
if [ -d "$HOME/augie-app/tools/go-drive" ]; then
  mkdir -p "$HOME/augie-tools"
  rsync -a "$HOME/augie-app/tools/go-drive/" "$HOME/augie-tools/" || fail "seal-stage"
  while IFS= read -r -d '' staged_src; do
    rel="${staged_src#"$HOME/augie-app/tools/go-drive/"}"
    src_hash="$(sha256sum "$staged_src" | cut -d' ' -f1)"
    dst_hash="$(sha256sum "$HOME/augie-tools/$rel" | cut -d' ' -f1)"
    [ "$src_hash" = "$dst_hash" ] || fail "seal-checksum $rel"
    chmod +x "$HOME/augie-tools/$rel" 2>/dev/null || true
    echo "seal tool staged + verified: $rel ($src_hash)"
  done < <(find "$HOME/augie-app/tools/go-drive" -type f -print0)
fi

systemctl --user restart augie.service || fail "restart"
sleep 4
CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/avatar || echo 000)"
echo "health check: /avatar -> $CODE"
[ "$CODE" = "200" ] || fail "health-check"
rm -rf "$TMP"
echo "=== update complete $(date -Is) — now at $HEAD_SHA ==="
