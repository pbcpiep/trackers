<#
  Home server check (Windows)
  ---------------------------
  Checks whether this computer is a good fit to run 24/7 as a small home server
  (Actual Budget in Docker). It only READS information; it changes nothing.

  How to run:
    1. Right-click the Start button, choose "Terminal (Admin)" or "Windows PowerShell (Admin)".
       (Admin lets it read disk health, battery wear and temperatures.)
    2. cd to the folder containing this file, e.g.:   cd $HOME\Downloads
    3. Run:   powershell -ExecutionPolicy Bypass -File .\check-server.ps1
       Optional 5-minute stress test (checks heat and throttling under full load):
              powershell -ExecutionPolicy Bypass -File .\check-server.ps1 -Stress

  A report is saved to your Desktop as server-check-report.txt.
  (This file is plain ASCII on purpose so Windows PowerShell 5.1 reads it correctly.)
#>
param(
  [switch]$Stress,
  [int]$StressMinutes = 5,
  [double]$PricePerKWh = 0.17
)

$ErrorActionPreference = 'SilentlyContinue'
$results = New-Object System.Collections.Generic.List[object]
$facts = New-Object System.Collections.Generic.List[string]
function Add-Result([string]$Area, [string]$Status, [string]$Detail, [string]$Advice = '') {
  $results.Add([pscustomobject]@{ Area = $Area; Status = $Status; Detail = $Detail; Advice = $Advice })
}
function Fact([string]$s) { $facts.Add($s) }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host ''
Write-Host 'Home server check - reading system information...' -ForegroundColor Cyan
if (-not $isAdmin) { Write-Host 'Not running as Administrator: disk health, battery wear and temperature checks may be skipped.' -ForegroundColor Yellow }

$recommendLinux = $false

# ---------------------------------------------------------------- Computer
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
Fact ("Computer: {0} {1}" -f $cs.Manufacturer, $cs.Model)
if ($bios.ReleaseDate) { Fact ("BIOS date: {0:yyyy-MM-dd} (rough hint of the machine's age)" -f $bios.ReleaseDate) }

# ---------------------------------------------------------------- Operating system
$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
Fact ("Windows: {0} (build {1}), last boot {2:yyyy-MM-dd HH:mm}" -f $os.Caption, $build, $os.LastBootUpTime)
if (-not $os) {
  Add-Result 'Operating system' 'INFO' 'Could not read Windows version' 'Make sure you are running this in Windows PowerShell.'
} elseif (-not [Environment]::Is64BitOperatingSystem) {
  Add-Result 'Operating system' 'FAIL' "$($os.Caption) is 32-bit" 'Docker and Actual need a 64-bit system. If the CPU below is 64-bit, install 64-bit Linux (e.g. Ubuntu Server 24.04 LTS).'
  $recommendLinux = $true
} elseif ($build -ge 22000) {
  Add-Result 'Operating system' 'PASS' "$($os.Caption) (build $build)"
} elseif ($build -ge 10240) {
  Add-Result 'Operating system' 'WARN' "$($os.Caption) (build $build)" 'Windows 10 stopped getting free security updates in October 2025. For an always-on machine, installing Linux (e.g. Ubuntu Server 24.04 LTS) is safer and lighter.'
  $recommendLinux = $true
} else {
  Add-Result 'Operating system' 'WARN' "$($os.Caption) (build $build)" 'This Windows version no longer gets security updates and cannot run Docker Desktop. Install Linux (e.g. Ubuntu Server 24.04 LTS) instead.'
  $recommendLinux = $true
}

# ---------------------------------------------------------------- CPU
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cores = [int]$cpu.NumberOfCores
$threads = [int]$cpu.NumberOfLogicalProcessors
$cpuName = ($cpu.Name -replace '\s+', ' ').Trim()
if (-not $cpu) {
  Add-Result 'CPU' 'INFO' 'Could not read CPU details' 'Look it up in Settings > System > About.'
} elseif ($cpu.DataWidth -ne 64) {
  Add-Result 'CPU' 'FAIL' "$cpuName is 32-bit only" 'This CPU cannot run Docker or current Actual Budget. Not viable as a server.'
} elseif ($cores -ge 2) {
  Add-Result 'CPU' 'PASS' "$cpuName - $cores cores / $threads threads"
} else {
  Add-Result 'CPU' 'WARN' "$cpuName - $cores core / $threads threads" 'Single-core CPUs work for Actual alone but will feel slow. Use a light Linux install.'
}

# Virtualization only matters for Docker Desktop on Windows (WSL2); Linux runs Docker natively.
if ($cs.HypervisorPresent) {
  Add-Result 'Virtualization' 'PASS' 'Enabled (a hypervisor is already running, so WSL2/Docker Desktop will work)'
} elseif ($cpu.VirtualizationFirmwareEnabled) {
  Add-Result 'Virtualization' 'PASS' 'Enabled in firmware'
} elseif ($cpu.VMMonitorModeExtensions) {
  Add-Result 'Virtualization' 'WARN' 'Supported by the CPU but turned off in BIOS/UEFI' 'To use Docker Desktop on Windows, enable "Intel VT-x" / "AMD-V (SVM)" in the BIOS setup. Not needed if you install Linux.'
} else {
  Add-Result 'Virtualization' 'WARN' 'Not available or not reported' 'Docker Desktop on Windows needs CPU virtualization. Linux runs Docker without it.'
  $recommendLinux = $true
}

# ---------------------------------------------------------------- Memory
$ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$sticks = @(Get-CimInstance Win32_PhysicalMemory)
$ramDetail = "$ramGB GB"
if ($sticks.Count -gt 0) { $ramDetail += " ($($sticks.Count) module(s))" }
if (-not $os.TotalVisibleMemorySize) {
  Add-Result 'Memory (RAM)' 'INFO' 'Could not read memory size' 'Look it up in Settings > System > About.'
} elseif ($ramGB -ge 8) {
  Add-Result 'Memory (RAM)' 'PASS' $ramDetail
} elseif ($ramGB -ge 3.5) {
  Add-Result 'Memory (RAM)' 'WARN' $ramDetail 'Tight for Windows + Docker Desktop (8 GB recommended). Plenty for Linux, where Actual uses about 200-300 MB.'
  $recommendLinux = $true
} elseif ($ramGB -ge 1.8) {
  Add-Result 'Memory (RAM)' 'WARN' $ramDetail 'Too little for Windows + Docker Desktop. Fine for a minimal Linux install (Debian or Ubuntu Server).'
  $recommendLinux = $true
} else {
  Add-Result 'Memory (RAM)' 'FAIL' $ramDetail 'Under 2 GB is too little even for Linux + Docker. A RAM upgrade may be cheap; check the model for supported modules.'
}

# ---------------------------------------------------------------- Disks
$sysDrive = $env:SystemDrive
$ld = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$sysDrive'"
if ($ld) {
  $freeGB = [math]::Round($ld.FreeSpace / 1GB, 1); $sizeGB = [math]::Round($ld.Size / 1GB, 1)
  if ($freeGB -ge 50) { Add-Result 'Free space' 'PASS' "$freeGB GB free of $sizeGB GB on $sysDrive" }
  elseif ($freeGB -ge 20) { Add-Result 'Free space' 'WARN' "$freeGB GB free of $sizeGB GB on $sysDrive" 'Enough for Actual, but Windows updates and Docker images need room. Aim for 50 GB free.' }
  else { Add-Result 'Free space' 'FAIL' "$freeGB GB free of $sizeGB GB on $sysDrive" 'Free up space or use a bigger drive (a 250 GB SSD is inexpensive).' }
}

$pdisks = @(Get-PhysicalDisk)
if ($pdisks.Count -eq 0) {
  Add-Result 'Disk health' 'INFO' 'Could not list physical disks (older Windows?)' 'Check the drive with CrystalDiskInfo (free) if possible.'
}
$smart = @{}
foreach ($f in @(Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus)) { if ($f.PredictFailure) { $smart['any'] = $true } }
foreach ($d in $pdisks) {
  $name = "$($d.FriendlyName) ($([math]::Round($d.Size / 1GB)) GB, $($d.MediaType), $($d.BusType))"
  $rel = $null
  if ($isAdmin) { $rel = $d | Get-StorageReliabilityCounter }
  $extra = @()
  if ($rel) {
    if ($rel.PowerOnHours) { $extra += "$($rel.PowerOnHours) power-on hours" }
    if ($rel.Wear -ne $null -and $rel.Wear -gt 0) { $extra += "wear $($rel.Wear)%" }
    if ($rel.Temperature) { $extra += "$($rel.Temperature) C" }
    if ($rel.ReadErrorsUncorrected) { $extra += "$($rel.ReadErrorsUncorrected) uncorrected read errors" }
  }
  $detail = $name + $(if ($extra.Count) { ' - ' + ($extra -join ', ') } else { '' })
  if ($d.HealthStatus -ne 'Healthy' -and $d.HealthStatus) {
    Add-Result 'Disk health' 'FAIL' "$detail - health: $($d.HealthStatus)" 'This drive is reporting problems. Replace it before trusting it with your data.'
  } elseif ($rel -and $rel.ReadErrorsUncorrected -gt 0) {
    Add-Result 'Disk health' 'FAIL' $detail 'Uncorrected read errors mean the drive is failing. Replace it.'
  } elseif ($rel -and $rel.Wear -ge 80) {
    Add-Result 'Disk health' 'WARN' $detail 'This SSD is near the end of its rated life. Plan to replace it.'
  } elseif ($d.MediaType -eq 'HDD') {
    $adv = 'Works, but spinning drives are slower, louder and wear out. A small SSD (about $25-35) is the single best upgrade for a 24/7 machine.'
    if ($rel -and $rel.PowerOnHours -gt 35000) { $adv = 'This hard drive has run for 4+ years of hours. Replace it with an SSD before using it 24/7.' }
    Add-Result 'Disk health' 'WARN' $detail $adv
  } else {
    Add-Result 'Disk health' 'PASS' $detail
  }
}
if ($smart['any']) { Add-Result 'Disk SMART' 'FAIL' 'A drive is predicting its own failure (SMART)' 'Back up anything important now and replace the drive.' }
if (-not $isAdmin) { Add-Result 'Disk health' 'INFO' 'Detailed wear/error counters need Administrator' 'Re-run from an Admin terminal for the full disk check.' }

# ---------------------------------------------------------------- Battery / power
$battery = Get-CimInstance Win32_Battery
$isLaptop = [bool]$battery
if ($isLaptop) {
  $design = (Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData | Select-Object -First 1).DesignedCapacity
  $full = (Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1).FullChargedCapacity
  if ($design -and $full) {
    $health = [math]::Round(100 * $full / $design)
    $detail = "Laptop battery at $health% of original capacity"
    if ($health -ge 60) {
      Add-Result 'Battery' 'PASS' $detail 'Bonus: it acts as a built-in backup during short power cuts. If the maker offers a charge limit (e.g. Lenovo Vantage, Dell "Primarily AC use", ASUS/MyASUS 60-80%), turn it on for 24/7 use.'
    } else {
      Add-Result 'Battery' 'WARN' $detail 'The battery is worn, so it will not cover outages for long. Check it is not swollen (bulging case or trackpad). If it is, stop using the laptop until the battery is removed.'
    }
  } else {
    Add-Result 'Battery' 'INFO' 'Laptop battery present; capacity not readable' 'For details run:  powercfg /batteryreport  and open the HTML file it creates.'
  }
} else {
  Add-Result 'Battery' 'INFO' 'Desktop (no battery)' 'Optional: a small UPS (about $50-70) keeps it running through brief power blips and lets it shut down cleanly.'
}

# ---------------------------------------------------------------- Stability history
$since = (Get-Date).AddDays(-90)
$unexpected = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'; Id = 41; StartTime = $since }).Count
$bsod = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WER-SystemErrorReporting'; Id = 1001; StartTime = $since }).Count
$whea = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WHEA-Logger'; StartTime = $since; Level = 2, 3 }).Count
$diskErr = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'disk'; Id = 7, 51, 153; StartTime = $since }).Count
$stab = "Last 90 days: $bsod blue screens, $unexpected unexpected shutdowns, $whea hardware errors, $diskErr disk errors"
if ($bsod -gt 0 -or $whea -gt 0 -or $diskErr -gt 0) {
  Add-Result 'Stability' 'WARN' $stab 'Crashes or hardware errors suggest a problem (RAM, disk, heat or drivers). Run MemTest86 overnight and check the disk before using it 24/7.'
} elseif ($unexpected -gt 3) {
  Add-Result 'Stability' 'WARN' $stab 'Several unexpected shutdowns. These also happen after power cuts or holding the power button, but can mean overheating or a failing power supply.'
} else {
  Add-Result 'Stability' 'PASS' $stab
}

# ---------------------------------------------------------------- Network
$adapters = @(Get-NetAdapter -Physical)
$wired = @($adapters | Where-Object { $_.PhysicalMediaType -eq '802.3' -and $_.InterfaceDescription -notmatch 'Wi-?Fi|Wireless|802\.11' })
$wiredUp = @($wired | Where-Object { $_.Status -eq 'Up' })
if ($wiredUp.Count) { Add-Result 'Network' 'PASS' "Wired Ethernet connected ($($wiredUp[0].LinkSpeed))" }
elseif ($wired.Count) { Add-Result 'Network' 'WARN' 'Has an Ethernet port but it is not plugged in' 'Plug it into your router with a cable if you can; it is more reliable than Wi-Fi for a server.' }
else { Add-Result 'Network' 'WARN' 'Wi-Fi only' 'Wi-Fi works for Actual, but a cable (or a USB Ethernet adapter, about $15) is more reliable 24/7.' }

# ---------------------------------------------------------------- Temperature
function Get-TempC {
  $zones = @(Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature)
  if (-not $zones.Count) { return $null }
  $max = ($zones | ForEach-Object { ($_.CurrentTemperature / 10) - 273.15 } | Measure-Object -Maximum).Maximum
  return [math]::Round($max, 1)
}
$idleTemp = Get-TempC
if ($idleTemp -ne $null -and $idleTemp -gt 0) { Fact "Temperature now (idle): $idleTemp C" } else { Fact 'Temperature: not reported by this PC to Windows (common). Use HWiNFO or Core Temp if you want to see it.' }

# ---------------------------------------------------------------- Optional stress test
if ($Stress) {
  Write-Host ''
  Write-Host "Running a $StressMinutes-minute full-load test on $threads threads. The fans will speed up; that's expected." -ForegroundColor Cyan
  Write-Host 'Press Ctrl+C to stop early.' -ForegroundColor DarkGray
  $end = (Get-Date).AddMinutes($StressMinutes)
  $jobs = 1..$threads | ForEach-Object {
    Start-Job -ScriptBlock { param($until) $x = 0.0; while ((Get-Date) -lt $until) { for ($i = 0; $i -lt 100000; $i++) { $x = [math]::Sqrt($i + $x) } } } -ArgumentList $end
  }
  $maxTemp = $idleTemp; $minPerf = 1000; $samples = 0
  try {
    while ((Get-Date) -lt $end) {
      Start-Sleep -Seconds 15
      $t = Get-TempC; if ($t -ne $null -and ($maxTemp -eq $null -or $t -gt $maxTemp)) { $maxTemp = $t }
      $perf = $null
      try { $perf = (Get-Counter '\Processor Information(_Total)\% Processor Performance' -ErrorAction Stop).CounterSamples[0].CookedValue } catch { }
      if ($perf -and $perf -lt $minPerf) { $minPerf = $perf }
      $samples++
      $left = [math]::Max(0, [math]::Round(($end - (Get-Date)).TotalSeconds))
      Write-Host ("  {0,3}s left  temp: {1}  CPU speed: {2}" -f $left, $(if ($t -ne $null) { "$t C" } else { 'n/a' }), $(if ($perf) { "$([math]::Round($perf))% of base" } else { 'n/a' }))
    }
  } finally {
    $jobs | Stop-Job; $jobs | Remove-Job -Force
  }
  $parts = @()
  if ($maxTemp -ne $null) { $parts += "peak $maxTemp C" }
  if ($minPerf -lt 1000) { $parts += "lowest CPU speed $([math]::Round($minPerf))% of base" }
  $detail = "Survived $StressMinutes min at full load" + $(if ($parts.Count) { ' - ' + ($parts -join ', ') } else { '' })
  if ($maxTemp -ne $null -and $maxTemp -ge 95) {
    Add-Result 'Heat under load' 'WARN' $detail 'Running very hot. Clean dust out of the fans/vents; on older machines new thermal paste helps a lot. A server mostly idles, but this shows how it copes with heavy work.'
  } elseif ($minPerf -lt 60) {
    Add-Result 'Heat under load' 'WARN' $detail 'The CPU slowed down a lot under load (thermal throttling or a power-saving limit). Clean the fans and vents; it is still fine for light server use.'
  } else {
    Add-Result 'Heat under load' 'PASS' $detail
  }
} else {
  Add-Result 'Heat under load' 'INFO' 'Not tested' 'Optional: re-run with -Stress for a 5-minute full-load test.'
}

# ---------------------------------------------------------------- Power cost estimate
if ($isLaptop) { $wLo = 8; $wHi = 20 } else { $wLo = 25; $wHi = 70 }
$costLo = ($wLo * 730 / 1000 * $PricePerKWh).ToString('0.00'); $costHi = ($wHi * 730 / 1000 * $PricePerKWh).ToString('0.00')
Add-Result 'Electricity (estimate)' 'INFO' ("About {0}-{1} W while idle = roughly `${2}-`${3}/month at `${4}/kWh" -f $wLo, $wHi, $costLo, $costHi, $PricePerKWh) 'A plug-in power meter (about $20) gives the real number. Disabling sleep but letting the screen turn off keeps it low.'

# ---------------------------------------------------------------- Verdict
$fails = @($results | Where-Object Status -eq 'FAIL')
$warns = @($results | Where-Object Status -eq 'WARN')
if ($fails.Count) {
  $verdict = 'NOT READY as-is. Fix the FAIL items below (often a cheap part, e.g. an SSD), then re-run.'
} elseif ($warns.Count) {
  $verdict = 'VIABLE with a few tweaks. Read the WARN items below.'
} else {
  $verdict = 'GOOD TO GO. This machine should run Actual Budget 24/7 comfortably.'
}
if ($recommendLinux -and -not @($results | Where-Object { $_.Area -eq 'CPU' -and $_.Status -eq 'FAIL' }).Count) {
  $plan = 'Suggested setup: wipe it and install Ubuntu Server 24.04 LTS (free), then Docker + Actual + Tailscale. Linux is lighter, gets security updates, and runs Docker natively.'
} else {
  $plan = 'Suggested setup: keep Windows 11, install Docker Desktop (with WSL2), Actual and Tailscale, and set Windows to never sleep. (Ubuntu Server is an even lighter option.)'
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('HOME SERVER CHECK - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$lines.Add('')
$lines.Add('VERDICT: ' + $verdict)
$lines.Add($plan)
$lines.Add('')
foreach ($r in $results) {
  $lines.Add(('[{0}] {1}: {2}' -f $r.Status, $r.Area, $r.Detail))
  if ($r.Advice) { $lines.Add('       -> ' + $r.Advice) }
}
$lines.Add('')
$lines.Add('Details:')
foreach ($f in $facts) { $lines.Add('  ' + $f) }
$lines.Add('')
$lines.Add('Before running 24/7: set Power & sleep to "Never" sleep when plugged in, and turn on "restart after power loss" in the BIOS if it has that option.')

Write-Host ''
foreach ($l in $lines) {
  $color = 'Gray'
  if ($l -like '[[]PASS*') { $color = 'Green' } elseif ($l -like '[[]WARN*') { $color = 'Yellow' } elseif ($l -like '[[]FAIL*') { $color = 'Red' } elseif ($l -like 'VERDICT*') { $color = 'Cyan' }
  Write-Host $l -ForegroundColor $color
}

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { $desktop = $HOME }
$reportPath = Join-Path $desktop 'server-check-report.txt'
$lines | Out-File -FilePath $reportPath -Encoding ASCII
Write-Host ''
Write-Host "Report saved to: $reportPath" -ForegroundColor Cyan
Write-Host 'Paste its contents back to Claude for a recommendation.' -ForegroundColor Cyan
