#!/usr/bin/env bash
# Home server setup for Ubuntu 24.04 (Server or Desktop).
#
# Turns a fresh Ubuntu install into an always-on home server running
# Actual Budget, reachable privately from your phone through Tailscale.
# Safe to run again: every step checks what is already done.
#
#   sudo bash setup-ubuntu.sh
#
# What it does:
#   1. Installs updates and turns on automatic security updates
#      (with an automatic reboot at 04:30 when one is needed)
#   2. Keeps the machine awake: never sleeps, keeps running with the lid closed,
#      and turns the laptop screen off when idle
#   3. Limits battery charging to 80% if the laptop supports it
#   4. Installs Docker and starts Actual Budget (version pinned in actual/compose.yaml)
#   5. Sets up nightly backups (03:30), plus restore/update/status commands
#   6. Installs Tailscale and serves Actual at https://<this-computer>.<tailnet>.ts.net
#   7. Turns on the firewall (SSH and Tailscale allowed)
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTUAL_DIR=/opt/actual
BACKUP_DIR=/var/backups/actual
CHARGE_LIMIT="${CHARGE_LIMIT:-80}"
LOG=/var/log/home-server-setup.log

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '\033[33m    ! %s\033[0m\n' "$*"; }

if [ "$(id -u)" != 0 ]; then echo "Please run with sudo:  sudo bash $0" >&2; exit 1; fi
. /etc/os-release
if [ "${ID:-}" != ubuntu ]; then warn "This script is written for Ubuntu (found: ${PRETTY_NAME:-unknown}). Continuing anyway."; fi
ADMIN_USER="${SUDO_USER:-}"
exec > >(tee -a "$LOG") 2>&1
echo "Setup started $(date -Is)"

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
step "1/7  Updating Ubuntu (this can take a while the first time)"
apt-get update -q
apt-get -y -q upgrade
apt-get install -y -q unattended-upgrades curl jq ca-certificates ufw

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52home-server <<'EOF'
// Home server: install security updates automatically and reboot at night if needed.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
note "Automatic security updates: on (reboots at 04:30 only when an update needs it)"

# ---------------------------------------------------------------------------
step "2/7  Keeping the machine awake 24/7"
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/50-home-server.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null 2>&1 || true
note "Sleep and hibernate: disabled. Closing the lid: keeps running (after the reboot at the end)."

# Blank the text console after 60s so a laptop screen isn't lit 24/7.
if [ -f /etc/default/grub ] && ! grep -q 'consoleblank=' /etc/default/grub; then
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 consoleblank=60"/' /etc/default/grub
  update-grub >/dev/null 2>&1 || warn "update-grub failed; the screen may stay on (harmless)."
  note "Screen: turns off after 1 minute idle (text console)."
fi
if [ -n "$ADMIN_USER" ] && command -v gsettings >/dev/null && [ -n "$(pgrep -u "$ADMIN_USER" gnome-shell 2>/dev/null)" ]; then
  # Ubuntu Desktop: stop GNOME's own auto-suspend too.
  sudo -u "$ADMIN_USER" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u "$ADMIN_USER")/bus" \
    gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
step "3/7  Battery care"
limit_ok=0
for f in /sys/class/power_supply/BAT*/charge_control_end_threshold; do
  if [ -w "$f" ] && echo "$CHARGE_LIMIT" > "$f" 2>/dev/null; then limit_ok=1; fi
done
if [ "$limit_ok" = 1 ]; then
  sed "s/LIMIT/$CHARGE_LIMIT/" "$KIT_DIR/systemd/battery-charge-limit.service" > /etc/systemd/system/battery-charge-limit.service
  systemctl daemon-reload
  systemctl enable battery-charge-limit.service >/dev/null 2>&1
  note "Battery will stop charging at ${CHARGE_LIMIT}% (much gentler on a battery that's plugged in all the time)."
elif ls /sys/class/power_supply/BAT* >/dev/null 2>&1; then
  note "This laptop doesn't expose a charge limit to Linux. Check the BIOS for a 'battery charge limit'"
  note "or 'primarily AC use' option. Keep an eye out for battery swelling over time."
else
  note "No battery (desktop). Skipping."
fi

# ---------------------------------------------------------------------------
step "4/7  Installing Docker and Actual Budget"
if ! command -v docker >/dev/null; then
  apt-get install -y -q docker.io docker-compose-v2
fi
if ! docker compose version >/dev/null 2>&1; then apt-get install -y -q docker-compose-v2; fi
systemctl enable --now docker >/dev/null
[ -n "$ADMIN_USER" ] && usermod -aG docker "$ADMIN_USER"

mkdir -p "$ACTUAL_DIR/data"
if [ -f "$ACTUAL_DIR/compose.yaml" ] && ! cmp -s "$KIT_DIR/actual/compose.yaml" "$ACTUAL_DIR/compose.yaml"; then
  note "Keeping your existing $ACTUAL_DIR/compose.yaml (use 'sudo actual-update <version>' to change versions)."
else
  cp "$KIT_DIR/actual/compose.yaml" "$ACTUAL_DIR/compose.yaml"
fi
(cd "$ACTUAL_DIR" && docker compose pull -q && docker compose up -d)
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:5006/; then break; fi
  sleep 2
done
if curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:5006/; then
  note "Actual Budget is running ($(sed -n 's/.*image: *//p' "$ACTUAL_DIR/compose.yaml"))."
else
  warn "Actual didn't answer yet. Check with: cd $ACTUAL_DIR && sudo docker compose logs"
fi

# ---------------------------------------------------------------------------
step "5/7  Nightly backups and helper commands"
install -m 755 "$KIT_DIR/bin/actual-backup" "$KIT_DIR/bin/actual-restore" "$KIT_DIR/bin/actual-update" "$KIT_DIR/bin/server-status" /usr/local/bin/
install -m 644 "$KIT_DIR/systemd/actual-backup.service" "$KIT_DIR/systemd/actual-backup.timer" /etc/systemd/system/
if [ ! -f /etc/default/actual-backup ]; then
  cat > /etc/default/actual-backup <<'EOF'
# Settings for actual-backup (nightly at 03:30).
KEEP=14
# Optional second copy, e.g. an external or old hard drive mounted here:
# EXTRA_BACKUP_DIR=/mnt/backup/actual
# EXTRA_KEEP=60
EOF
fi
systemctl daemon-reload
systemctl enable --now actual-backup.timer >/dev/null
/usr/local/bin/actual-backup || warn "First backup failed; see the message above."
note "Backups: nightly at 03:30 into $BACKUP_DIR (14 kept)."
note "Commands: server-status, sudo actual-backup, sudo actual-restore, sudo actual-update <version>"

# ---------------------------------------------------------------------------
step "6/7  Tailscale (private access from your phone)"
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled >/dev/null
if ! tailscale status >/dev/null 2>&1; then
  note "Sign in to Tailscale: open the link below on your phone or another computer."
  note "(Use the same account you'll use in the Tailscale app on your phone.)"
  tailscale up
fi
TS_NAME="$(tailscale status --json | jq -r '.Self.DNSName // empty' | sed 's/\.$//')"
note "Turning on HTTPS for Actual. If Tailscale shows a link to enable HTTPS for your"
note "tailnet, open it, click Enable, and this will continue by itself."
if tailscale serve --bg 5006; then
  note "Actual is available to your devices at:  https://$TS_NAME"
else
  warn "Couldn't set up HTTPS. In the Tailscale admin console (login.tailscale.com/admin/dns),"
  warn "turn on MagicDNS and 'HTTPS Certificates', then run:  sudo tailscale serve --bg 5006"
fi

# ---------------------------------------------------------------------------
step "7/7  Firewall"
ufw allow OpenSSH >/dev/null
ufw allow in on tailscale0 >/dev/null
ufw --force enable >/dev/null
note "Firewall on: SSH and Tailscale allowed; Actual is not exposed to your home network or the internet."

# ---------------------------------------------------------------------------
printf '\n\033[1;32mAll set!\033[0m\n'
cat <<EOF

Next steps:
  1. Install the Tailscale app on your phone and sign in with the same account.
  2. On your phone, open  https://${TS_NAME:-<this-computer>.<tailnet>.ts.net}
     Set a server password, then create your budget.
  3. Optional bank sync: in Actual, go to Settings > Bank Sync > SimpleFIN
     (about \$15/year at beta-bridge.simplefin.org).
  4. Paste that address into your trackers app: Settings & reminders > Finances.
  5. Reboot once so every setting takes effect:  sudo reboot

Check on things any time with:  server-status
Setup log: $LOG
EOF
