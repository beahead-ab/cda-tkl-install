# Uppdaterar installationen på en PC: kör samma installationsrad som första gången, med den sparade token om
# förrådet är privat. Startas av panelen (Inställningar → Uppdatering → Uppdatera nu), som kör skriptet i en egen
# process så att det överlever att installeraren stoppar och startar om TKL, eller för hand:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\<Namn> TKL\update.ps1"
#
# Installeraren körs i den här processen (iex), så att dess uppstädning av gamla processer inte stoppar
# uppdateringen själv. Den gör resten: ny version bredvid den gamla, byte av current.txt, omstart, och
# återställning av föregående version om den nya inte svarar. Inställningar och driftdata ligger kvar.
$ErrorActionPreference = 'Stop'
$App = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force -Path (Join-Path $App 'logs') | Out-Null
$Log = Join-Path $App 'logs\update.log'
"== $(Get-Date -Format s) uppdatering startad" | Add-Content -Path $Log
try {
  $Repository = 'beahead-ab/cda-tkl-install'
  $EnvFile = Join-Path $App 'app.env'
  if (Test-Path $EnvFile) {
    $Line = Select-String -Path $EnvFile -Pattern '^CHARLOTTENDAL_INSTALL_REPOSITORY=(.*)$' | Select-Object -Last 1
    if ($Line) { $Value = $Line.Matches[0].Groups[1].Value.Trim().Trim('"'); if ($Value -match '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$') { $Repository = $Value } }
  }
  $TokenFile = Join-Path $App 'github-token'
  $Token = if (Test-Path $TokenFile) { (Get-Content $TokenFile -Raw).Trim() } else { '' }
  $Branch = if ($env:CDA_TKL_BRANCH) { $env:CDA_TKL_BRANCH } else { 'main' }
  $Url = "https://raw.githubusercontent.com/$Repository/$Branch/install.ps1"
  $Headers = @{}
  if ($Token) { $Headers = @{ Authorization = "Bearer $Token" }; $env:TKL_TOKEN = $Token }
  $Script = (Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $Headers).Content
  Invoke-Expression $Script *>> $Log
} catch {
  "FEL: $($_.Exception.Message)" | Add-Content -Path $Log
  exit 1
}
