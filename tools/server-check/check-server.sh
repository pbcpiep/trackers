#!/usr/bin/env bash
# Home server check (Linux and macOS)
# -----------------------------------
# Checks whether this computer is a good fit to run 24/7 as a small home
# server (Actual Budget in Docker). It only READS information; it changes
# nothing.
#
# How to run (in a terminal, from the folder containing this file):
#   bash check-server.sh              # about 30 seconds
#   bash check-server.sh --stress     # adds a 5-minute full-load heat test
#   sudo bash check-server.sh         # lets it read disk health (SMART)
#
# A report is saved to ~/server-check-report.txt.
# Works with the old bash 3.2 that ships on macOS.

STRESS=0
STRESS_MIN=5
PRICE=0.17
while [ $# -gt 0 ]; do
  case "$1" in
    --stress) STRESS=1 ;;
    --minutes) shift; STRESS_MIN="$1" ;;
    --price) shift; PRICE="$1" ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
  esac
  shift
done

OS="$(uname -s)"
RESULTS=""
FACTS=""
FAILS=0
WARNS=0
RECOMMEND_LINUX_INSTALL=0

add() { # status area detail [advice]
  RESULTS="${RESULTS}[$1] $2: $3
"
  [ -n "$4" ] && RESULTS="${RESULTS}       -> $4
"
  [ "$1" = FAIL ] && FAILS=$((FAILS + 1))
  [ "$1" = WARN ] && WARNS=$((WARNS + 1))
  return 0
}
fact() { FACTS="${FACTS}  $1
"; }
has() { command -v "$1" >/dev/null 2>&1; }
calc() { awk "BEGIN { printf \"$1\", $2 }"; }
IS_ROOT=0; [ "$(id -u)" = 0 ] && IS_ROOT=1

printf '\nHome server check - reading system information...\n'

if grep -qi microsoft /proc/version 2>/dev/null; then
  printf '\nYou are running this inside WSL (Linux on Windows), which would describe a virtual machine,\nnot your hardware. Run check-server.ps1 in Windows PowerShell instead.\n\n'
  exit 1
fi
if has systemd-detect-virt && VIRT="$(systemd-detect-virt 2>/dev/null)" && [ "$VIRT" != none ]; then
  add INFO "Virtual machine" "Running inside a VM ($VIRT)" "These results describe the virtual machine, not the physical computer."
fi

# ------------------------------------------------------------------ OS
if [ "$OS" = Darwin ]; then
  MACVER="$(sw_vers -productVersion 2>/dev/null)"
  MODEL="$(sysctl -n hw.model 2>/dev/null)"
  fact "Computer: Mac ($MODEL), macOS $MACVER"
  MAJOR="${MACVER%%.*}"
  if [ "${MAJOR:-0}" -ge 13 ]; then
    add PASS "Operating system" "macOS $MACVER"
  else
    add WARN "Operating system" "macOS $MACVER" "Older macOS no longer gets security updates, and current Docker Desktop needs a recent macOS. On an Intel Mac you can install Ubuntu Server instead."
    RECOMMEND_LINUX_INSTALL=1
  fi
else
  if [ -r /etc/os-release ]; then . /etc/os-release; fi
  DISTRO="${PRETTY_NAME:-Linux}"
  fact "Linux: $DISTRO, kernel $(uname -r)"
  [ -r /sys/class/dmi/id/sys_vendor ] && fact "Computer: $(cat /sys/class/dmi/id/sys_vendor 2>/dev/null) $(cat /sys/class/dmi/id/product_name 2>/dev/null)"
  [ -r /sys/class/dmi/id/bios_date ] && fact "BIOS date: $(cat /sys/class/dmi/id/bios_date) (rough hint of the machine's age)"
  add PASS "Operating system" "$DISTRO" "Make sure it still gets security updates (e.g. Ubuntu LTS, Debian stable)."
fi

# ------------------------------------------------------------------ CPU
ARCH="$(uname -m)"
if [ "$OS" = Darwin ]; then
  CPUNAME="$(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  CORES="$(sysctl -n hw.physicalcpu 2>/dev/null)"
  THREADS="$(sysctl -n hw.logicalcpu 2>/dev/null)"
  [ "$(sysctl -n hw.optional.x86_64 2>/dev/null)" = 1 ] && ARCH=x86_64
else
  CPUNAME="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//')"
  [ -z "$CPUNAME" ] && CPUNAME="$(grep -m1 -i '^model' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//')"
  THREADS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
  CORES="$(lscpu 2>/dev/null | awk -F: '/^Core\(s\) per socket/ {c=$2} /^Socket\(s\)/ {s=$2} END { if (c && s) print c*s }')"
  [ -z "$CORES" ] && CORES="$THREADS"
  # A 64-bit CPU can be running a 32-bit OS; the lm flag tells us.
  if [ "$ARCH" != x86_64 ] && grep -qw lm /proc/cpuinfo 2>/dev/null; then ARCH="x86_64-capable ($ARCH installed)"; fi
fi
CPUNAME="${CPUNAME:-unknown CPU}"
case "$ARCH" in
  x86_64|amd64|aarch64|arm64)
    if [ "${CORES:-1}" -ge 2 ]; then add PASS "CPU" "$CPUNAME - $CORES cores / $THREADS threads ($ARCH)"
    else add WARN "CPU" "$CPUNAME - $CORES core ($ARCH)" "Single-core CPUs work for Actual alone but feel slow."; fi ;;
  x86_64-capable*)
    add WARN "CPU" "$CPUNAME - 64-bit CPU but a 32-bit system is installed" "Reinstall with a 64-bit Linux (e.g. Ubuntu Server 24.04 LTS); Docker needs it."
    RECOMMEND_LINUX_INSTALL=1 ;;
  *)
    add FAIL "CPU" "$CPUNAME ($ARCH)" "Docker and current Actual Budget need a 64-bit x86 or ARM CPU. Not viable as a server." ;;
esac

# ------------------------------------------------------------------ Memory
if [ "$OS" = Darwin ]; then
  RAM_KB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 ))
else
  RAM_KB="$(awk '/^MemTotal/ {print $2}' /proc/meminfo 2>/dev/null)"
fi
RAM_GB="$(calc '%.1f' "${RAM_KB:-0} / 1048576")"
if [ "${RAM_KB:-0}" -ge 3500000 ]; then add PASS "Memory (RAM)" "$RAM_GB GB" "Actual itself uses about 200-300 MB."
elif [ "${RAM_KB:-0}" -ge 1800000 ]; then add WARN "Memory (RAM)" "$RAM_GB GB" "Enough for a minimal Linux + Docker + Actual, but little room for anything else."
elif [ "${RAM_KB:-0}" -gt 0 ]; then add FAIL "Memory (RAM)" "$RAM_GB GB" "Under 2 GB is too little for Linux + Docker. A RAM upgrade may be cheap."
else add INFO "Memory (RAM)" "Could not read"; fi

# ------------------------------------------------------------------ Disk space
FREE_KB="$(df -Pk / 2>/dev/null | awk 'NR==2 {print $4}')"
SIZE_KB="$(df -Pk / 2>/dev/null | awk 'NR==2 {print $2}')"
if [ -n "$FREE_KB" ]; then
  FREE_GB="$(calc '%.0f' "$FREE_KB / 1048576")"; SIZE_GB="$(calc '%.0f' "$SIZE_KB / 1048576")"
  if [ "$FREE_KB" -ge 52428800 ]; then add PASS "Free space" "$FREE_GB GB free of $SIZE_GB GB"
  elif [ "$FREE_KB" -ge 20971520 ]; then add WARN "Free space" "$FREE_GB GB free of $SIZE_GB GB" "Enough for Actual; aim for 50 GB free to leave room for updates and backups."
  else add FAIL "Free space" "$FREE_GB GB free of $SIZE_GB GB" "Free up space or use a bigger drive (a 250 GB SSD is inexpensive)."; fi
fi

# ------------------------------------------------------------------ Disk type & health
if [ "$OS" = Darwin ]; then
  DINFO="$(diskutil info disk0 2>/dev/null)"
  SOLID="$(echo "$DINFO" | awk -F: '/Solid State/ {gsub(/^ +/,"",$2); print $2}')"
  SMARTST="$(echo "$DINFO" | awk -F: '/SMART Status/ {gsub(/^ +/,"",$2); print $2}')"
  DNAME="$(echo "$DINFO" | awk -F: '/Device \/ Media Name/ {gsub(/^ +/,"",$2); print $2}')"
  DETAIL="${DNAME:-disk0} ($( [ "$SOLID" = Yes ] && echo SSD || echo HDD )), SMART: ${SMARTST:-unknown}"
  if [ "$SMARTST" = Failing ]; then add FAIL "Disk health" "$DETAIL" "The drive reports it is failing. Replace it before trusting it with data."
  elif [ "$SOLID" != Yes ]; then add WARN "Disk health" "$DETAIL" "Works, but spinning drives are slower and wear out. An SSD (about \$25-35) is the best upgrade for 24/7 use."
  else add PASS "Disk health" "$DETAIL"; fi
else
  ROOTSRC="$(df -P / 2>/dev/null | awk 'NR==2 {print $1}')"
  ROOTDISK="$(lsblk -no PKNAME "$ROOTSRC" 2>/dev/null | head -1)"
  [ -z "$ROOTDISK" ] && ROOTDISK="$(basename "$ROOTSRC" 2>/dev/null | sed 's/p\{0,1\}[0-9]*$//')"
  FOUND=0
  for dev in $(lsblk -dno NAME,TYPE 2>/dev/null | awk '$2=="disk" {print $1}'); do
    case "$dev" in zram*|loop*|ram*) continue ;; esac
    FOUND=1
    ROTA="$(cat /sys/block/$dev/queue/rotational 2>/dev/null)"
    MODELN="$(cat /sys/block/$dev/device/model 2>/dev/null | sed 's/ *$//')"
    SIZEB="$(lsblk -dbno SIZE /dev/$dev 2>/dev/null)"
    [ "${SIZEB:-0}" -ge 4000000000 ] || continue     # skip empty card readers and tiny helper disks
    SZ="$(calc '%.0f' "${SIZEB:-0} / 1000000000")"
    KIND=SSD; [ "$ROTA" = 1 ] && KIND=HDD
    case "$dev" in mmcblk*) KIND="SD/eMMC" ;; esac
    DETAIL="/dev/$dev ${MODELN:+$MODELN }(${SZ} GB, $KIND)"
    [ "$dev" = "$ROOTDISK" ] && DETAIL="$DETAIL [system disk]"
    HEALTH=""
    if has smartctl && [ "$IS_ROOT" = 1 ]; then
      SOUT="$(smartctl -H -A "/dev/$dev" 2>/dev/null)"
      echo "$SOUT" | grep -qiE 'result: FAILED|Critical Warning: +0x0*[1-9a-f]' && HEALTH=FAILED
      HOURS="$(echo "$SOUT" | awk '/Power_On_Hours/ {print $10} /Power On Hours:/ {gsub(/[,]/,"",$4); print $4}' | head -1)"
      REALLOC="$(echo "$SOUT" | awk '/Reallocated_Sector_Ct|Current_Pending_Sector|Offline_Uncorrectable/ {s+=$10} END {print s+0}')"
      WEAR="$(echo "$SOUT" | awk '/Percentage Used:/ {gsub(/%/,"",$3); print $3}')"
      [ -n "$HOURS" ] && DETAIL="$DETAIL - $HOURS power-on hours"
      [ -n "$WEAR" ] && DETAIL="$DETAIL, wear $WEAR%"
      [ "${REALLOC:-0}" -gt 0 ] && DETAIL="$DETAIL, $REALLOC bad/pending sectors"
    fi
    if [ "$HEALTH" = FAILED ]; then add FAIL "Disk health" "$DETAIL" "The drive reports it is failing. Replace it before trusting it with data."
    elif [ "${REALLOC:-0}" -gt 0 ]; then add WARN "Disk health" "$DETAIL" "Bad sectors mean the drive is wearing out. Replace it before using it 24/7."
    elif [ -n "$WEAR" ] && [ "$WEAR" -ge 80 ]; then add WARN "Disk health" "$DETAIL" "This SSD is near the end of its rated life."
    elif [ "$KIND" = "SD/eMMC" ]; then add WARN "Disk health" "$DETAIL" "SD cards and eMMC wear out under constant writes. Put the system (or at least Actual's data) on an SSD."
    elif [ "$KIND" = HDD ]; then
      if [ -n "$HOURS" ] && [ "$HOURS" -gt 35000 ]; then add WARN "Disk health" "$DETAIL" "This hard drive has run 4+ years of hours. Swap in an SSD before using it 24/7."
      else add WARN "Disk health" "$DETAIL" "Works, but spinning drives are slower and wear out. An SSD (about \$25-35) is the best upgrade for 24/7 use."; fi
    else add PASS "Disk health" "$DETAIL"; fi
    REALLOC=""; WEAR=""; HOURS=""
  done
  [ "$FOUND" = 0 ] && add INFO "Disk health" "Could not list disks"
  if ! has smartctl; then add INFO "Disk SMART" "smartmontools not installed" "For a full health check: sudo apt install smartmontools, then re-run with sudo."
  elif [ "$IS_ROOT" = 0 ]; then add INFO "Disk SMART" "Skipped (needs sudo)" "Re-run with: sudo bash check-server.sh"; fi
fi

# ------------------------------------------------------------------ Battery
LAPTOP=0
if [ "$OS" = Darwin ]; then
  PWR="$(system_profiler SPPowerDataType 2>/dev/null)"
  if echo "$PWR" | grep -q "Cycle Count"; then
    LAPTOP=1
    CYCLES="$(echo "$PWR" | awk -F: '/Cycle Count/ {gsub(/ /,"",$2); print $2}')"
    COND="$(echo "$PWR" | awk -F: '/Condition/ {gsub(/^ +/,"",$2); print $2}')"
    MAXC="$(echo "$PWR" | awk -F: '/Maximum Capacity/ {gsub(/[ %]/,"",$2); print $2}')"
    DETAIL="MacBook battery: condition ${COND:-unknown}, ${CYCLES:-?} cycles${MAXC:+, $MAXC% of original capacity}"
    if [ "$COND" = Normal ] && [ "${MAXC:-100}" -ge 60 ]; then
      add PASS "Battery" "$DETAIL" "Bonus: it covers short power cuts. Turn on Optimized Battery Charging (or a charge-limit app) for 24/7 use."
    else
      add WARN "Battery" "$DETAIL" "The battery is worn. Check it is not swollen (bulging case or trackpad); if it is, stop using it until it is replaced."
    fi
  fi
else
  for b in /sys/class/power_supply/BAT*; do
    [ -d "$b" ] || continue
    LAPTOP=1
    FULL="$(cat "$b/energy_full" 2>/dev/null || cat "$b/charge_full" 2>/dev/null)"
    DESIGN="$(cat "$b/energy_full_design" 2>/dev/null || cat "$b/charge_full_design" 2>/dev/null)"
    if [ -n "$FULL" ] && [ -n "$DESIGN" ] && [ "$DESIGN" -gt 0 ]; then
      HEALTH_PCT=$(( 100 * FULL / DESIGN ))
      if [ "$HEALTH_PCT" -ge 60 ]; then add PASS "Battery" "Laptop battery at $HEALTH_PCT% of original capacity" "Bonus: it covers short power cuts. If your laptop supports a charge limit (e.g. TLP's charge thresholds), set 60-80% for 24/7 use."
      else add WARN "Battery" "Laptop battery at $HEALTH_PCT% of original capacity" "The battery is worn. Check it is not swollen (bulging case or trackpad); if it is, stop using it until the battery is removed."; fi
    else
      add INFO "Battery" "Laptop battery present; capacity not readable"
    fi
    break
  done
fi
[ "$LAPTOP" = 0 ] && add INFO "Battery" "Desktop (no battery)" "Optional: a small UPS (about \$50-70) keeps it running through brief power blips."

# ------------------------------------------------------------------ Stability
if [ "$OS" = Darwin ]; then
  PANICS="$(find /Library/Logs/DiagnosticReports -maxdepth 2 \( -name '*.panic' -o -name 'Kernel*' \) -mtime -90 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${PANICS:-0}" -gt 0 ]; then add WARN "Stability" "$PANICS kernel panic report(s) in the last 90 days" "Crashes can point to failing RAM, disk or heat. Run Apple Diagnostics (hold D at startup)."
  else add PASS "Stability" "No kernel panics in the last 90 days"; fi
else
  CRASHES="$(last -x 2>/dev/null | grep -c crash)"
  HWERR=0; IOERR=0
  if has journalctl; then
    KLOG="$(journalctl -k --since '-90d' -p err --no-pager 2>/dev/null)"
    HWERR="$(echo "$KLOG" | grep -ciE 'mce|machine check|hardware error|edac')"
    IOERR="$(echo "$KLOG" | grep -ciE 'i/o error|medium error|ata[0-9.]+: .*(failed|error)')"
    BOOTS="$(journalctl --list-boots --no-pager 2>/dev/null | wc -l | tr -d ' ')"
    [ "${BOOTS:-0}" -gt 0 ] && fact "Boots in the system journal: $BOOTS"
  fi
  STAB="Last 90 days: ${CRASHES:-0} unclean shutdowns, $HWERR hardware errors, $IOERR disk I/O errors"
  if [ "$HWERR" -gt 0 ] || [ "$IOERR" -gt 0 ]; then add WARN "Stability" "$STAB" "Hardware or disk errors. Check the disk (smartctl) and run MemTest86 overnight before using it 24/7."
  elif [ "${CRASHES:-0}" -gt 3 ]; then add WARN "Stability" "$STAB" "Several unclean shutdowns: power cuts, or possibly overheating or a weak power supply."
  else add PASS "Stability" "$STAB"; fi
fi
UPTXT="$(uptime 2>/dev/null | sed 's/^ *//')"
[ -n "$UPTXT" ] && fact "Uptime: $UPTXT"

# ------------------------------------------------------------------ Network
WIRED=""; WIRED_UP=""
if [ "$OS" = Darwin ]; then
  PORTS="$(networksetup -listallhardwareports 2>/dev/null)"
  for dev in $(echo "$PORTS" | awk '/Hardware Port: .*(Ethernet|LAN|Thunderbolt Ethernet)/ {getline; print $2}'); do
    WIRED="$dev"
    ifconfig "$dev" 2>/dev/null | grep -q 'status: active' && WIRED_UP="$dev"
  done
else
  for n in /sys/class/net/*; do
    dev="$(basename "$n")"
    [ -e "$n/device" ] || continue          # skip virtual interfaces (docker, lo, vpn)
    [ -d "$n/wireless" ] && continue        # skip Wi-Fi
    [ -d "$n/phy80211" ] && continue
    WIRED="$dev"
    [ "$(cat "$n/operstate" 2>/dev/null)" = up ] && WIRED_UP="$dev"
  done
fi
if [ -n "$WIRED_UP" ]; then add PASS "Network" "Wired Ethernet connected ($WIRED_UP)"
elif [ -n "$WIRED" ]; then add WARN "Network" "Has an Ethernet port ($WIRED) but it is not connected" "Plug it into your router with a cable if you can; more reliable than Wi-Fi for a server."
else add WARN "Network" "Wi-Fi only" "Wi-Fi works for Actual, but a cable (or a USB Ethernet adapter, about \$15) is more reliable 24/7."; fi

# ------------------------------------------------------------------ Temperature
read_temp() {
  if [ "$OS" = Darwin ]; then return 0; fi
  if has sensors; then
    T="$(sensors 2>/dev/null | awk '/^(Package id|Tctl|Tdie|Core [0-9]+|temp1)/ { for (i=2;i<=NF;i++) if ($i ~ /^\+[0-9.]+°?C/) { gsub(/[+°C]/,"",$i); if ($i+0>m) m=$i+0; break } } END { if (m) printf "%.0f", m }')"
    [ -n "$T" ] && { echo "$T"; return 0; }
  fi
  M=0
  for z in /sys/class/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp*_input; do
    [ -r "$z" ] || continue
    v="$(cat "$z" 2>/dev/null)"; [ -n "$v" ] && [ "$v" -gt "$M" ] && [ "$v" -lt 130000 ] && M="$v"
  done
  [ "$M" -gt 0 ] && echo $((M / 1000))
  return 0
}
IDLE_T="$(read_temp)"
if [ -n "$IDLE_T" ]; then fact "Temperature now (idle): ${IDLE_T} C"
elif [ "$OS" = Darwin ]; then fact "Temperature: not readable without extra tools on macOS"
else fact "Temperature: not reported (install lm-sensors to see it)"; fi

# ------------------------------------------------------------------ Optional stress test
if [ "$STRESS" = 1 ]; then
  printf '\nRunning a %s-minute full-load test on %s threads. Fans will speed up; that is expected.\nPress Ctrl+C to stop early.\n' "$STRESS_MIN" "$THREADS"
  PIDS=""
  i=0; while [ "$i" -lt "${THREADS:-1}" ]; do yes > /dev/null & PIDS="$PIDS $!"; i=$((i + 1)); done
  trap 'kill $PIDS 2>/dev/null' EXIT INT TERM
  MAXT="${IDLE_T:-}"; MINPCT=1000
  MAXF="$(cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null)"
  END=$(( $(date +%s) + STRESS_MIN * 60 ))
  while [ "$(date +%s)" -lt "$END" ]; do
    sleep 15
    T="$(read_temp)"
    [ -n "$T" ] && { [ -z "$MAXT" ] || [ "$T" -gt "$MAXT" ]; } && MAXT="$T"
    PCT=""
    if [ -n "$MAXF" ]; then
      CURF="$(cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq 2>/dev/null | awk '{s+=$1; n++} END { if (n) printf "%.0f", s/n }')"
      [ -n "$CURF" ] && PCT=$(( 100 * CURF / MAXF )) && [ "$PCT" -lt "$MINPCT" ] && MINPCT="$PCT"
    fi
    printf '  %3ss left  temp: %s  CPU speed: %s\n' "$(( END - $(date +%s) > 0 ? END - $(date +%s) : 0 ))" "${T:+$T C}${T:-n/a}" "${PCT:+$PCT% of max}${PCT:-n/a}"
  done
  kill $PIDS 2>/dev/null; trap - EXIT INT TERM
  DETAIL="Survived $STRESS_MIN min at full load"
  [ -n "$MAXT" ] && DETAIL="$DETAIL - peak ${MAXT} C"
  [ "$MINPCT" -lt 1000 ] && DETAIL="$DETAIL, lowest CPU speed ${MINPCT}% of max"
  if [ -n "$MAXT" ] && [ "$MAXT" -ge 95 ]; then add WARN "Heat under load" "$DETAIL" "Running very hot. Clean dust from fans and vents; new thermal paste helps older machines a lot."
  elif [ "$MINPCT" -lt 50 ]; then add WARN "Heat under load" "$DETAIL" "The CPU slowed down a lot under load (throttling). Clean the fans; still fine for light server use."
  else add PASS "Heat under load" "$DETAIL"; fi
else
  add INFO "Heat under load" "Not tested" "Optional: re-run with --stress for a 5-minute full-load test."
fi

# ------------------------------------------------------------------ Power estimate
if [ "$LAPTOP" = 1 ]; then WLO=8; WHI=20; else WLO=25; WHI=70; fi
CLO="$(calc '%.2f' "$WLO * 730 / 1000 * $PRICE")"; CHI="$(calc '%.2f' "$WHI * 730 / 1000 * $PRICE")"
add INFO "Electricity (estimate)" "About $WLO-$WHI W while idle = roughly \$$CLO-\$$CHI/month at \$$PRICE/kWh" "A plug-in power meter (about \$20) gives the real number."

# ------------------------------------------------------------------ Verdict
if [ "$FAILS" -gt 0 ]; then VERDICT="NOT READY as-is. Fix the FAIL items below (often a cheap part, e.g. an SSD), then re-run."
elif [ "$WARNS" -gt 0 ]; then VERDICT="VIABLE with a few tweaks. Read the WARN items below."
else VERDICT="GOOD TO GO. This machine should run Actual Budget 24/7 comfortably."; fi
if [ "$RECOMMEND_LINUX_INSTALL" = 1 ]; then PLAN="Suggested setup: install Ubuntu Server 24.04 LTS (free), then Docker + Actual + Tailscale."
elif [ "$OS" = Darwin ]; then PLAN="Suggested setup: Docker Desktop (or OrbStack) + Actual + Tailscale, and set the Mac to never sleep (System Settings > Energy/Battery)."
else PLAN="Suggested setup: install Docker, then Actual + Tailscale. Disable suspend (e.g. sudo systemctl mask sleep.target suspend.target hibernate.target)."; fi

REPORT="HOME SERVER CHECK - $(date '+%Y-%m-%d %H:%M')

VERDICT: $VERDICT
$PLAN

${RESULTS}
Details:
${FACTS}
Before running 24/7: turn off sleep, and turn on \"restart after power loss\" in the BIOS/firmware if it has that option."

printf '\n'
printf '%s\n' "$REPORT" | while IFS= read -r line; do
  case "$line" in
    "[PASS]"*) printf '\033[32m%s\033[0m\n' "$line" ;;
    "[WARN]"*) printf '\033[33m%s\033[0m\n' "$line" ;;
    "[FAIL]"*) printf '\033[31m%s\033[0m\n' "$line" ;;
    VERDICT*) printf '\033[36m%s\033[0m\n' "$line" ;;
    *) printf '%s\n' "$line" ;;
  esac
done

OUT="${HOME:-.}/server-check-report.txt"
if [ -n "$SUDO_USER" ] && [ "$OS" != Darwin ]; then OUT="$(getent passwd "$SUDO_USER" | cut -d: -f6)/server-check-report.txt"; fi
[ -n "$SUDO_USER" ] && [ "$OS" = Darwin ] && OUT="/Users/$SUDO_USER/server-check-report.txt"
printf '%s\n' "$REPORT" > "$OUT" && printf '\nReport saved to: %s\nPaste its contents back to Claude for a recommendation.\n' "$OUT"
