# Installs Charlottendal TKL on a Windows 10/11 PC for the logged-in user. In PowerShell:
#
#   irm https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.ps1 | iex
#
# Its own Node 22 from nodejs.org (checksum verified), the signal box and the LocoNet
# simulator started hidden at login and restarted if they stop, and a desktop shortcut
# that opens the panel in Edge or Chrome (WebHID, for the Stream Deck). Run it again to
# update; the settings and operating data are kept. No administrator rights are needed.
# $env:CDA_TKL_TOKEN reads the package from a private repository instead (forks).
# Everything runs in its own scope, so settings and variables do not leak into the
# user's PowerShell session, and a failure is reported instead of closing the window.
& {
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repository = 'beahead-ab/cda-tkl-install'
$Branch = if ($env:CDA_TKL_BRANCH) { $env:CDA_TKL_BRANCH } else { 'main' }
$App = if ($env:CDA_TKL_HOME) { $env:CDA_TKL_HOME } else { Join-Path $env:LOCALAPPDATA 'Charlottendal TKL' }
$NodeDir = Join-Path $App 'node'
$NodeMajor = 22
$Temp = Join-Path ([IO.Path]::GetTempPath()) ('cda-tkl-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $Temp, (Join-Path $App 'releases'), (Join-Path $App 'state'), (Join-Path $App 'logs') | Out-Null

function Get-File($Url, $Path, $Headers = @{}) { Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Path -Headers $Headers }

try {
  # Node.js 22 in our own folder; the system's Node (if any) is neither used nor changed.
  $Arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $Current = if (Test-Path (Join-Path $NodeDir 'node.exe')) { & (Join-Path $NodeDir 'node.exe') -p 'process.versions.node' } else { '' }
  if (-not $Current.StartsWith("$NodeMajor.")) {
    Write-Host "Hämtar Node.js $NodeMajor …"
    $Base = "https://nodejs.org/dist/latest-v$NodeMajor.x"
    Get-File "$Base/SHASUMS256.txt" (Join-Path $Temp 'SHASUMS256.txt')
    $Line = Get-Content (Join-Path $Temp 'SHASUMS256.txt') | Where-Object { $_ -match "node-v[\d.]+-win-$Arch\.zip$" } | Select-Object -First 1
    if (-not $Line) { throw "Hittade ingen Node.js $NodeMajor för win-$Arch." }
    $Hash, $File = $Line -split '\s+'
    $Zip = Join-Path $Temp $File
    Get-File "$Base/$File" $Zip
    if ((Get-FileHash -Algorithm SHA256 $Zip).Hash -ne $Hash.ToUpper()) { throw 'Node.js-filen stämmer inte med sin kontrollsumma.' }
    Expand-Archive -Path $Zip -DestinationPath (Join-Path $Temp 'node') -Force
    if (Test-Path $NodeDir) { Remove-Item -Recurse -Force $NodeDir }
    Move-Item (Get-ChildItem (Join-Path $Temp 'node') -Directory | Select-Object -First 1).FullName $NodeDir
  }

  # The package from GitHub, or from CDA_TKL_SOURCE (a folder or a .zip) for tests.
  if ($env:CDA_TKL_SOURCE -and (Test-Path $env:CDA_TKL_SOURCE -PathType Container)) {
    $Source = (Resolve-Path $env:CDA_TKL_SOURCE).Path
  } else {
    $Archive = Join-Path $Temp 'cda-tkl.zip'
    if ($env:CDA_TKL_SOURCE) { Copy-Item $env:CDA_TKL_SOURCE $Archive }
    else {
      Write-Host 'Hämtar Charlottendal TKL …'
      if ($env:CDA_TKL_TOKEN) {
        Get-File "https://api.github.com/repos/$Repository/zipball/$Branch" $Archive @{ Authorization = "Bearer $env:CDA_TKL_TOKEN"; Accept = 'application/vnd.github+json' }
      } else {
        Get-File "https://github.com/$Repository/archive/refs/heads/$Branch.zip" $Archive
      }
    }
    Expand-Archive -Path $Archive -DestinationPath (Join-Path $Temp 'package') -Force
    $Source = (Get-ChildItem (Join-Path $Temp 'package') -Directory | Select-Object -First 1).FullName
  }
  if (-not (Test-Path (Join-Path $Source 'src\server.mjs'))) { throw 'Installationspaketet är ofullständigt.' }
  $Version = (Get-Content (Join-Path $Source 'package.json') -Raw | ConvertFrom-Json).version
  Write-Host "Installerar Charlottendal TKL $Version …"

  # Each installation is a folder of its own; current.txt names the one in use.
  $Release = Join-Path $App ("releases\$Version-" + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
  New-Item -ItemType Directory -Force -Path $Release | Out-Null
  foreach ($Item in 'package.json', 'package-lock.json', 'public', 'src', 'scripts', 'profiles') {
    $Path = Join-Path $Source $Item
    if (Test-Path $Path) { Copy-Item -Recurse -Force $Path $Release }
  }
  Write-Host 'Installerar beroenden …'
  $env:Path = "$NodeDir;$env:Path"
  Push-Location $Release
  try { & (Join-Path $NodeDir 'npm.cmd') ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error; if ($LASTEXITCODE) { throw 'npm ci misslyckades.' } }
  finally { Pop-Location }
  & (Join-Path $NodeDir 'node.exe') --check (Join-Path $Release 'src\server.mjs'); if ($LASTEXITCODE) { throw 'Programmet kunde inte läsas.' }
  $Pointer = Join-Path $App 'current.txt'
  $Previous = if (Test-Path $Pointer) { (Get-Content $Pointer -Raw).Trim() } else { '' }
  Set-Content -Path $Pointer -Value $Release -Encoding UTF8
  Get-ChildItem (Join-Path $App 'releases') -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3 |
    Where-Object { $_.FullName -ne $Release } | Remove-Item -Recurse -Force

  # Settings, written once and kept by updates.
  $EnvFile = Join-Path $App 'app.env'
  if (-not (Test-Path $EnvFile)) {
    (Get-Content (Join-Path $Source 'packaging\raspberry-pi\app.env')) -replace '^CHARLOTTENDAL_STATE_DIR=.*', ("CHARLOTTENDAL_STATE_DIR=" + (Join-Path $App 'state')) -replace '^CHARLOTTENDAL_INSTALL_KIND=.*', 'CHARLOTTENDAL_INSTALL_KIND=windows' |
      Set-Content -Path $EnvFile -Encoding UTF8
  }
  if (-not (Select-String -Path $EnvFile -Pattern '^CHARLOTTENDAL_INSTALL_KIND=' -Quiet)) { Add-Content -Path $EnvFile -Value 'CHARLOTTENDAL_INSTALL_KIND=windows' -Encoding UTF8 }
  Copy-Item -Force (Join-Path $Source 'packaging\windows\run.ps1') (Join-Path $App 'run.ps1')

  # Started hidden at login (Startup folder; no administrator rights needed).
  $Shell = New-Object -ComObject WScript.Shell
  $PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $Startup = $Shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Charlottendal TKL.lnk'))
  $Startup.TargetPath = $PowerShell
  $Startup.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $App 'run.ps1')`""
  $Startup.WindowStyle = 7
  $Startup.Save()

  # The panel as its own window: Edge or Chrome, both have WebHID for the Stream Deck.
  $Browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  $Panel = $Shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Charlottendal TKL.lnk'))
  if ($Browser) { $Panel.TargetPath = $Browser; $Panel.Arguments = '--app=http://127.0.0.1:8910/#panel' }
  else { $Panel.TargetPath = 'http://127.0.0.1:8910/#panel' }
  $Panel.Save()

  if ($env:CDA_TKL_NO_START) { Write-Host "Startas inte (CDA_TKL_NO_START)."; return }
  # Stop a running copy, then start the new one the way login does.
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$App*" -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  function Start-Tkl { Start-Process -FilePath $PowerShell -WindowStyle Hidden -ArgumentList '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $App 'run.ps1') }
  function Wait-Tkl { for ($i = 0; $i -lt 40; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8910/api/config | Out-Null; return $true } catch { Start-Sleep 1 } }; return $false }
  Start-Tkl
  if (-not (Wait-Tkl)) {
    Write-Host "TKL svarar inte. Loggen finns i: $(Join-Path $App 'logs')"
    if ($Previous -and (Test-Path $Previous)) {
      Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$App*" -and $_.ProcessId -ne $PID } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      Set-Content -Path $Pointer -Value $Previous -Encoding UTF8
      Remove-Item -Recurse -Force $Release
      Start-Tkl; [void](Wait-Tkl)
      Write-Host "Föregående version är återställd: $Previous"
    }
    throw 'Den nya versionen startade inte.'
  }
  Write-Host ''
  Write-Host "Charlottendal TKL $Version är installerad och startar när du loggar in."
  Write-Host 'Ställverket:  http://127.0.0.1:8910   Anläggningssimulatorn:  http://127.0.0.1:8911'
  Write-Host "Genvägen 'Charlottendal TKL' finns på skrivbordet. Uppdatera genom att köra installationsraden igen."
  Start-Process (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Charlottendal TKL.lnk')
}
catch {
  Write-Host ''
  Write-Host ('Installationen avbröts: ' + $_.Exception.Message) -ForegroundColor Red
}
finally {
  Remove-Item -Recurse -Force $Temp -ErrorAction SilentlyContinue
}
}
