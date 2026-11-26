#!/usr/bin/env bash
# GRID-DOWN EXCHANGE — one-time daemon setup on the core (the Parrot).
#
# Run ONCE, as root, from the app tree:
#     sudo bash scripts/parrot-exchange-setup.sh
#
# What it does:
#   · installs the sync engine (scripts/parrot-exchange-sync.py)
#     to /usr/local/lib/augie-exchange/sync.py;
#   · makes the door's own SSH host key (the main sshd is never
#     touched — the exchange runs its own sshd, on its own port,
#     from its own config);
#   · installs three systemd units:
#       augie-exchange-sshd.service  — the dedicated SFTP service
#       augie-exchange-sync.service  — one sync run
#       augie-exchange-sync.timer    — a sync every minute
#   · runs one sync, so the door takes the store's state at once.
#
# The sync reads the app's store (~/.local/share/augie/exchange/
# exchange.json) and the ALL-STOP flag, and builds the real door
# from them. The service runs only while the Captain's switch is
# on in the Exchange window and the ALL-STOP is off. Nothing here
# opens the door by itself — the Captain opens it in the app.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this as root: sudo bash scripts/parrot-exchange-setup.sh" >&2
  exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="/usr/local/lib/augie-exchange"

install -d -m 755 "$LIB_DIR"
install -m 755 "$APP_DIR/scripts/parrot-exchange-sync.py" "$LIB_DIR/sync.py"

if [[ ! -f /etc/ssh/augie-exchange-hostkey ]]; then
  ssh-keygen -t ed25519 -f /etc/ssh/augie-exchange-hostkey -N "" -C "augie-exchange-door"
  chmod 600 /etc/ssh/augie-exchange-hostkey
fi

cat > /etc/systemd/system/augie-exchange-sshd.service <<'UNIT'
[Unit]
Description=Augie Grid-Down Exchange — dedicated SFTP door
After=network.target
ConditionPathExists=/etc/ssh/augie-exchange.conf

[Service]
Type=simple
ExecStart=/usr/sbin/sshd -D -e -f /etc/ssh/augie-exchange.conf
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/augie-exchange-sync.service <<'UNIT'
[Unit]
Description=Augie Grid-Down Exchange — sync the door from the core store

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/augie-exchange/sync.py
UNIT

cat > /etc/systemd/system/augie-exchange-sync.timer <<'UNIT'
[Unit]
Description=Keep the Grid-Down Exchange door in step with the core store

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=augie-exchange-sync.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now augie-exchange-sync.timer
python3 "$LIB_DIR/sync.py" || true

echo
echo "The exchange door's machinery is in place."
echo "The door itself opens only from the app: Tools → Records & safety →"
echo "Grid-Down Exchange — give a person access there, then open the door."
echo "The sync follows the store (and the ALL-STOP) every minute."
