#!/usr/bin/env python3
"""
GRID-DOWN EXCHANGE — daemon sync (runs as root on the core).

The app half of the exchange lives in the core store:
    ~/.local/share/augie/exchange/exchange.json
This script is the daemon half. It reads THAT SAME FILE (plus
the device core's ALL-STOP flag in devices-core.json) and
builds the real door from it:

  · one locked-down system user per live grant, chrooted to
    /srv/augie-exchange/<username>, key-only login (the public
    key from the store — there are no passwords in this system);
  · the shared Outbox bind-mounted read-only into the chroot
    of anyone with download access (and nobody else's);
  · a per-person Inbox folder bind-mounted in for anyone with
    upload access (and nobody else's) — arrivals land in
    exchange/inbox/<username>/ where the app lists them under
    that person's name;
  · a dedicated sshd on the store's port, its own config and
    host key, passwords refused;
  · the service runs only while the door stands open in the
    store AND the ALL-STOP is off — checked every sync;
  · the service's own connection lines are copied from the
    journal into exchange/connections.log (epoch-ms prefixed),
    where the app reads them for the window's log.

Revoked or expired grants lose their key and their mounts at
the next sync. Nothing is deleted: users, folders, and files
stay; access is what comes and goes.

Installed by scripts/parrot-exchange-setup.sh; run every
minute by augie-exchange-sync.timer, and once by hand:
    sudo python3 /usr/local/lib/augie-exchange/sync.py
"""

import glob
import grp
import json
import os
import pwd
import shutil
import subprocess
import sys
import time

BASE = "/srv/augie-exchange"
GROUP = "augie-exchange"
SSHD_CONF = "/etc/ssh/augie-exchange.conf"
HOST_KEY = "/etc/ssh/augie-exchange-hostkey"
SERVICE = "augie-exchange-sshd.service"


def run(*args: str, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=check)


def find_exchange_dir() -> str | None:
    env = os.environ.get("AUGIE_EXCHANGE_DIR", "").strip()
    if env and os.path.isfile(os.path.join(env, "exchange.json")):
        return env
    for candidate in sorted(glob.glob("/home/*/.local/share/augie/exchange")):
        if os.path.isfile(os.path.join(candidate, "exchange.json")):
            return candidate
    return None


def read_json(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def is_mounted(path: str) -> bool:
    try:
        with open("/proc/mounts", encoding="utf-8") as fh:
            return any(line.split(" ")[1] == path.replace(" ", "\\040") for line in fh)
    except Exception:
        return False


def ensure_mount(source: str, target: str, readonly: bool) -> None:
    os.makedirs(target, exist_ok=True)
    os.chown(target, 0, 0)
    if not is_mounted(target):
        run("mount", "--bind", source, target)
    if readonly:
        run("mount", "-o", "remount,bind,ro", target)


def drop_mount(target: str) -> None:
    if os.path.isdir(target) and is_mounted(target):
        run("umount", target)


def main() -> int:
    if os.geteuid() != 0:
        print("parrot-exchange-sync must run as root (it builds system users and mounts).")
        return 1
    exchange_dir = find_exchange_dir()
    if not exchange_dir:
        print("No exchange store found yet (the app creates it on the core). Nothing to sync.")
        return 0
    augie_dir = os.path.dirname(exchange_dir)
    store = read_json(os.path.join(exchange_dir, "exchange.json"))
    devices = read_json(os.path.join(augie_dir, "devices-core.json"))
    app_user = pwd.getpwuid(os.stat(exchange_dir).st_uid).pw_name

    try:
        grp.getgrnam(GROUP)
    except KeyError:
        run("groupadd", "--system", GROUP)

    now_ms = int(time.time() * 1000)
    all_stop = bool((devices.get("allStop") or {}).get("active"))
    enabled = store.get("enabled") is True
    port = store.get("port") if isinstance(store.get("port"), int) else 2222
    grants = store.get("grants") if isinstance(store.get("grants"), list) else []

    def is_live(g: dict) -> bool:
        if not isinstance(g, dict):
            return False
        if (g.get("revokedAt") or 0) > 0:
            return False
        expires = g.get("expiresAt") or 0
        return expires == 0 or now_ms < expires

    live = [g for g in grants if is_live(g)]
    dead = [g for g in grants if isinstance(g, dict) and not is_live(g)]
    door_open = enabled and not all_stop

    os.makedirs(BASE, mode=0o755, exist_ok=True)

    # ---- live grants: user, chroot, key, mounts ----------------------
    for grant in live:
        username = str(grant.get("username") or "").strip()
        access = str(grant.get("access") or "download")
        public_key = str(grant.get("publicKey") or "").strip()
        if not username or not public_key.startswith("ssh-ed25519 "):
            continue
        home = os.path.join(BASE, username)
        try:
            pwd.getpwnam(username)
        except KeyError:
            run("useradd", "-M", "-d", home, "-s", "/usr/sbin/nologin", "-G", GROUP, username)
        # '*' = no password login, account not locked (a '!' would lock keys out too).
        run("usermod", "-p", "*", username)
        os.makedirs(home, mode=0o755, exist_ok=True)
        os.chown(home, 0, 0)
        os.chmod(home, 0o755)
        ssh_dir = os.path.join(home, ".ssh")
        os.makedirs(ssh_dir, mode=0o755, exist_ok=True)
        os.chown(ssh_dir, 0, 0)
        keys_path = os.path.join(ssh_dir, "authorized_keys")
        with open(keys_path, "w", encoding="utf-8") as fh:
            fh.write(public_key + "\n")
        os.chown(keys_path, 0, 0)
        os.chmod(keys_path, 0o644)

        outbox_target = os.path.join(home, "outbox")
        if access in ("download", "both"):
            ensure_mount(os.path.join(exchange_dir, "outbox"), outbox_target, readonly=True)
        else:
            drop_mount(outbox_target)

        inbox_target = os.path.join(home, "inbox")
        if access in ("upload", "both"):
            person_inbox = os.path.join(exchange_dir, "inbox", username)
            os.makedirs(person_inbox, mode=0o700, exist_ok=True)
            os.chown(person_inbox, pwd.getpwnam(app_user).pw_uid, pwd.getpwnam(app_user).pw_gid)
            ensure_mount(person_inbox, inbox_target, readonly=False)
        else:
            drop_mount(inbox_target)

    # ---- dead grants: key out, mounts down, account locked -----------
    for grant in dead:
        username = str(grant.get("username") or "").strip()
        if not username:
            continue
        home = os.path.join(BASE, username)
        drop_mount(os.path.join(home, "outbox"))
        drop_mount(os.path.join(home, "inbox"))
        keys_path = os.path.join(home, ".ssh", "authorized_keys")
        if os.path.isfile(keys_path):
            os.remove(keys_path)
        try:
            pwd.getpwnam(username)
            run("usermod", "-p", "!", username)
        except KeyError:
            pass

    # ---- the dedicated sshd config -----------------------------------
    lines = [
        "# Grid-Down Exchange — generated by parrot-exchange-sync.py from the core store.",
        "# Do not edit by hand; change the store (the Exchange window) instead.",
        f"Port {port}",
        "ListenAddress 0.0.0.0",
        f"HostKey {HOST_KEY}",
        "PidFile /run/augie-exchange-sshd.pid",
        "PasswordAuthentication no",
        "PubkeyAuthentication yes",
        "AuthenticationMethods publickey",
        f"AllowGroups {GROUP}",
        f"AuthorizedKeysFile {BASE}/%u/.ssh/authorized_keys",
        "Subsystem sftp internal-sftp",
        "LogLevel VERBOSE",
        "SyslogFacility AUTH",
        "UsePAM yes",
        "",
    ]
    for grant in live:
        username = str(grant.get("username") or "").strip()
        if not username:
            continue
        lines += [
            f"Match User {username}",
            f"    ChrootDirectory {BASE}/{username}",
            "    ForceCommand internal-sftp",
            "    AllowTcpForwarding no",
            "    X11Forwarding no",
            "",
        ]
    conf_text = "\n".join(lines)
    conf_changed = True
    if os.path.isfile(SSHD_CONF):
        with open(SSHD_CONF, encoding="utf-8") as fh:
            conf_changed = fh.read() != conf_text
    if conf_changed:
        with open(SSHD_CONF, "w", encoding="utf-8") as fh:
            fh.write(conf_text)
        os.chmod(SSHD_CONF, 0o644)

    sshd = shutil.which("sshd") or "/usr/sbin/sshd"
    check = run(sshd, "-t", "-f", SSHD_CONF)
    if check.returncode != 0:
        print(f"sshd refuses the generated config — door left as it was:\n{check.stderr}")
        return 1

    # ---- service state follows the door ------------------------------
    if shutil.which("systemctl"):
        active = run("systemctl", "is-active", "--quiet", SERVICE).returncode == 0
        if door_open and (not active or conf_changed):
            run("systemctl", "restart" if active else "start", SERVICE)
        elif not door_open and active:
            run("systemctl", "stop", SERVICE)

    # ---- arrivals belong to the Captain ------------------------------
    app = pwd.getpwnam(app_user)
    inbox_root = os.path.join(exchange_dir, "inbox")
    for root, _dirs, files in os.walk(inbox_root):
        for name in files:
            path = os.path.join(root, name)
            try:
                if os.stat(path).st_uid != app.pw_uid:
                    os.chown(path, app.pw_uid, app.pw_gid)
            except OSError:
                pass

    # ---- the service's own log, where the app can read it ------------
    journal = run(
        "journalctl", "-u", SERVICE, "-o", "json", "--no-pager", "-n", "400",
    )
    if journal.returncode == 0 and journal.stdout.strip():
        out_lines = []
        for raw in journal.stdout.splitlines():
            try:
                item = json.loads(raw)
                stamp = int(item.get("__REALTIME_TIMESTAMP", "0")) // 1000
                message = str(item.get("MESSAGE", ""))
                if stamp and message:
                    out_lines.append(f"{stamp} {message}")
            except Exception:
                continue
        log_path = os.path.join(exchange_dir, "connections.log")
        with open(log_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(out_lines) + ("\n" if out_lines else ""))
        os.chown(log_path, app.pw_uid, app.pw_gid)
        os.chmod(log_path, 0o640)

    state = "OPEN" if door_open else "CLOSED"
    print(
        f"Exchange door {state} (switch {'on' if enabled else 'off'}, "
        f"all-stop {'ON' if all_stop else 'off'}), port {port}, "
        f"{len(live)} live grant(s), {len(dead)} dead."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
