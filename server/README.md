# Home server kit: Actual Budget on your old laptop

This folder turns an old laptop into an always-on, private server for **Actual Budget**. You reach it from your phone anywhere through **Tailscale**. Nothing is exposed to the internet, and there are no monthly fees.

**Start here:** run the [server check](../tools/server-check/README.md) on the laptop first. Its report decides which of the three setups below fits.

---

## Your questions, answered

**Does installing Ubuntu wipe the whole drive?**
Only if you choose to. You have three options:

| Setup | Your files and Windows | Difficulty | Best when |
| --- | --- | --- | --- |
| **A. Ubuntu *alongside* Windows** | **Kept.** The installer shrinks Windows to make room. You pick Windows or Ubuntu when the laptop starts, and Ubuntu is the default. | Medium | You want Linux's reliability but can't lose what's on the drive |
| **B. Replace Windows with Ubuntu** | **Erased.** Everything on the drive is wiped. | Easiest install, cleanest server | Everything important is backed up elsewhere, or there's nothing to keep |
| **C. Keep Windows, add Actual** | **Untouched.** Nothing is erased or resized. | Easy, but less reliable 24/7 | The server check says Windows 11 with 8 GB+ RAM, or you'd rather not touch the drive |

**Whatever you choose, back up the files you care about first.** Resizing a drive (A) is usually fine, but "usually" isn't good enough for files you can't replace. Options:
- copy them to an external USB hard drive
- upload them to Google Drive, OneDrive or iCloud
- copy them to another computer

A 1 TB external drive costs about $50, and it can hold your nightly budget backups afterwards too.

**Why a USB stick, and is it dangerous?**
The USB stick (8 GB or more) is only the *installer*. You copy Ubuntu onto it and start the laptop from it.
- **Making the installer erases the USB stick only**, not your laptop or its 1 TB drive. Use an empty stick.
- Your laptop's drive is only touched later, inside the installer, and only in the way you choose (A or B).
- Setup C needs no USB stick at all.

**My laptop has no Ethernet port. Is that a problem?**
No. Wi-Fi works fine for this; Ethernet is just a bit more reliable. Some things to know:
- **Ubuntu Desktop (setups A and B):** connect to Wi-Fi from the top-right menu, just like on a phone.
- **Ubuntu Server:** Wi-Fi is set up in the installer's "Network" screen.
- **If Wi-Fi isn't detected during install:** plug your phone in by USB and turn on **USB tethering**. That works as a wired connection.
- **Optional:** a USB-to-Ethernet adapter is about $15 if you ever want a cable.
- **Placement:** keep the laptop somewhere with a strong Wi-Fi signal.

**Do I need to keep the laptop open?**
No. The setup tells it to keep running with the lid closed, never sleep, and turn the screen off. Keep it somewhere ventilated, not on a bed or carpet.

---

## Setup A or B: Ubuntu (recommended for 24/7)

### What you need
- the laptop, plugged in
- a USB stick of 8 GB or more that can be erased
- your Wi-Fi password
- about 1 hour

### 1. Back up
Copy anything you want to keep off the laptop (see above).

**Setup A only:** if Windows has BitLocker or "Device encryption" turned on, go to Settings → Privacy & security → Device encryption and turn it **off** first. Also save your recovery key from https://account.microsoft.com/devices/recoverykey. Otherwise the installer can't resize Windows.

### 2. Make the installer USB (on any Windows or Mac computer)
1. Download **Ubuntu Desktop 24.04 LTS** from https://ubuntu.com/download/desktop.
   - Desktop is friendlier than Server: it has a normal Wi-Fi menu and a browser for downloading this kit, and it's the version that offers "install alongside Windows".
   - The setup script works on both.
2. Write it to the USB stick:
   - **Windows:** use [Rufus](https://rufus.ie). Select the stick and the downloaded `.iso`, then click Start.
   - **Mac:** use [balenaEtcher](https://etcher.balena.io).

### 3. Install Ubuntu
1. Plug the USB into the laptop and turn it on while tapping the **boot menu key**. It's usually F12; on some laptops it's F9, F10, Esc, or F2 for the BIOS setup. Choose the USB stick.
2. Pick **Try or Install Ubuntu**, then **Install Ubuntu**, and connect to Wi-Fi when asked.
3. On the **"How do you want to install Ubuntu?"** screen:
   - **Setup A:** choose **Install Ubuntu alongside Windows**. Give Ubuntu at least **60 GB**; more is fine.
   - **Setup B:** choose **Erase disk and install Ubuntu**. This erases everything on the drive.
4. Create your user and password (write them down), then finish and restart. Remove the USB when told to.

### 4. Get this kit onto the laptop
In Ubuntu, open Firefox, go to this repository on github.com and sign in. Choose **Code → Download ZIP**, then open **Files → Downloads** and double-click the ZIP to extract it.

### 5. Run the setup script
Open **Terminal** (press Ctrl+Alt+T) and run:
```bash
cd ~/Downloads/trackers-*/server
sudo bash setup-ubuntu.sh
```
It takes about 10–15 minutes. It will:
- update Ubuntu and turn on automatic security updates
- stop the laptop from ever sleeping
- limit battery charging to 80% if the laptop supports it
- install Docker and Actual Budget
- set up nightly backups
- install Tailscale and turn on the firewall

**When it asks you to sign in to Tailscale:** open the link it shows on your phone and create a free account, with Google or Apple sign-in for example. If it shows another link to "enable HTTPS", open that too and click Enable.

### 6. Connect your phone
1. Install the **Tailscale** app (iPhone or Android) and sign in with the same account.
2. Open the address the setup printed, like `https://your-laptop.tail1234.ts.net`, and bookmark it or use "Add to Home Screen".
3. In Actual, **set a server password**, then create a budget.
4. Run `sudo reboot` once on the laptop so every setting takes effect.

### Everyday commands (in Terminal on the laptop)
| Command | What it does |
| --- | --- |
| `server-status` | One-screen health check: Actual, backups, Tailscale, disk, temperature, battery, updates |
| `sudo actual-backup` | Back up now (it also runs by itself every night at 3:30) |
| `sudo actual-restore` | Restore the newest backup (keeps a copy of what it replaces) |
| `sudo actual-update 26.10.0` | Update Actual to a new version (backs up first). Versions: https://github.com/actualbudget/actual/releases |

**A second backup copy (recommended):** plug in an external drive and edit `/etc/default/actual-backup` to set `EXTRA_BACKUP_DIR` to a folder on that drive. Setup B can also use a second internal drive the same way. Nightly backups are then copied there too.

---

## Setup C: keep Windows as it is

Nothing on the drive is erased or resized. The trade-off: Docker Desktop only runs while someone is signed in to Windows, so the laptop has to sign itself in after restarts.

1. **Windows Update:** install all updates. Windows 10 is out of support, so prefer Windows 11 if the laptop can run it.
2. **Power settings:** Settings → System → Power: set **Sleep: Never** when plugged in. Control Panel → Power Options → *Choose what closing the lid does* → **Do nothing** when plugged in.
3. **Install Docker Desktop** from https://www.docker.com/products/docker-desktop and accept the WSL 2 option. In its Settings, tick **Start Docker Desktop when you sign in**.
4. **Start Actual:**
   - Create the folder `C:\actual` and copy [`actual/compose.yaml`](actual/compose.yaml) into it.
   - In PowerShell, run:
     ```
     cd C:\actual
     docker compose up -d
     ```
5. **Install Tailscale** for Windows from https://tailscale.com/download and sign in. Then, in an Admin PowerShell, run:
   ```
   tailscale serve --bg 5006
   ```
   Open the link it shows if it asks you to enable HTTPS. Your address is shown in the Tailscale app, like `https://laptop-name.tail1234.ts.net`.
6. **Nightly backups:** in an Admin PowerShell, from the `server\windows` folder, run:
   ```
   powershell -ExecutionPolicy Bypass -File .\actual-backup.ps1 -Install
   ```
   This backs up `C:\actual\data` to `Documents\Actual Backups` every night (14 kept).
7. **Automatic sign-in after restarts:** Windows 11 needs a small settings change for this. Ask Claude for the steps once you're at this point.

---

## Bank sync with SimpleFIN (optional, about $15/year)

1. Sign up at https://beta-bridge.simplefin.org, connect your banks there, and create a **Setup Token**.
2. In Actual: **Settings → Bank Sync → SimpleFIN**, then paste the token.
3. For each account in Actual: account menu → **Link account**, and pick the matching SimpleFIN account.
4. Transactions then come in when you click **Sync**. Rules you create (for example "Starbucks → Eating out") categorize them automatically.

Until then, or instead, download CSV/OFX files from your bank's website and use **Import** on each account.

---

## Files in this kit

```
setup-ubuntu.sh                 one-time setup for Ubuntu 24.04 (Desktop or Server)
actual/compose.yaml             Actual Budget container (version pinned)
bin/actual-backup               nightly backup (stops Actual ~5 s for a consistent copy)
bin/actual-restore              restore a backup (undoable)
bin/actual-update               change Actual version safely
bin/server-status               health check
systemd/actual-backup.*         nightly backup timer (03:30, catches up after downtime)
systemd/battery-charge-limit.*  keeps the battery at 80% on laptops that support it
windows/actual-backup.ps1       backups for Setup C (Task Scheduler)
```
