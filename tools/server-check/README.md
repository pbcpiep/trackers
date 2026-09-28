# Can my old computer be a 24/7 home server?

These scripts check whether an old computer is a good fit to run Actual Budget (and other small services) around the clock. They **only read** information and change nothing. Each run ends with a verdict:
- **GOOD TO GO**
- **VIABLE with a few tweaks**
- **NOT READY as-is**

You also get a report file you can paste back to Claude.

What they check:
- operating system support
- 64-bit CPU and core count
- RAM
- free space
- SSD vs hard drive, and disk health
- battery wear (laptops)
- crashes and hardware errors in the last 90 days
- wired vs Wi-Fi
- temperatures
- a rough electricity cost

An optional 5-minute stress test checks for overheating and throttling.

## 1. Get the script onto the old computer

On the old computer, open this repository on github.com and sign in. Open the file you need and click **Download raw file** (the download icon). You can also copy it over on a USB stick.

- **Windows:** `check-server.ps1`
- **Linux or Mac:** `check-server.sh`

## 2a. Windows

1. Right-click the **Start** button and choose **Terminal (Admin)** or **Windows PowerShell (Admin)**.
2. Go to the folder you saved it in, for example:
   ```
   cd $HOME\Downloads
   ```
3. Run:
   ```
   powershell -ExecutionPolicy Bypass -File .\check-server.ps1
   ```
   To add the 5-minute heat test:
   ```
   powershell -ExecutionPolicy Bypass -File .\check-server.ps1 -Stress
   ```

`-ExecutionPolicy Bypass` applies to this one run only; it doesn't change your settings. The report is saved to your Desktop as `server-check-report.txt`.

## 2b. Linux or Mac

```
cd ~/Downloads
bash check-server.sh            # quick check
sudo bash check-server.sh       # adds disk health (Linux: install smartmontools first)
bash check-server.sh --stress   # adds the 5-minute heat test
```

The report is saved to `~/server-check-report.txt`.

## 3. Send back the result

Paste the contents of `server-check-report.txt` to Claude. You'll get a recommendation and, if the machine is viable, step-by-step setup instructions (Ubuntu Server or Windows, Docker, Actual, Tailscale, backups).

## Notes

- **Heat test:** fans getting loud is normal. Press **Ctrl+C** to stop early.
- **"Unexpected shutdowns"** also count power cuts and holding the power button, so a few aren't alarming.
- **Temperature:** many Windows PCs don't report it. That's normal; the test still checks whether the CPU slows down under load.
- **Electricity cost:** this is an estimate for a typical machine of that type. A $20 plug-in power meter gives the real number.
