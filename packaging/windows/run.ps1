# Started hidden at login: reads the settings and runs the signal box and the LocoNet
# simulator from the release named in current.txt, starting them again if they stop.
$App = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Join-Path $App 'node\node.exe'
$Log = Join-Path $App 'logs\tkl.log'
Get-Content (Join-Path $App 'app.env') | Where-Object { $_ -match '^\s*([A-Z_]+)=(.*)$' } | ForEach-Object {
  [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process')
}
while ($true) {
  $Release = (Get-Content (Join-Path $App 'current.txt') -Raw).Trim()
  Push-Location $Release
  & $Node scripts/start.mjs *>> $Log
  Pop-Location
  Start-Sleep -Seconds 2
}
