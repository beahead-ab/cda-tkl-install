# Installera Charlottendal TKL

Charlottendal TKL installeras med en rad på alla tre plattformarna. Raden hämtar programmet från
GitHub, en egen Node.js 22 från nodejs.org (kontrollerad mot sin kontrollsumma) och sätter upp
ställverket och anläggningssimulatorn så att de startar av sig själva. Ställverket nås sedan på
<http://127.0.0.1:8910> och simulatorn på <http://127.0.0.1:8911>, bara från datorn själv.

| Plattform | När den passar | Rad |
|---|---|---|
| **Raspberry Pi 5** | Ett fristående ställverk på träffen, helskärm från start | `curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh \| sudo sh` |
| **Mac** | Ställverket på en bärbar eller stationär Mac | `curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh \| sh` |
| **PC (Windows 10/11)** | Ställverket på en vanlig PC | `irm https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.ps1 \| iex` |

Raspberry Pi har en egen, fullständig anvisning: **[Installera på Raspberry Pi 5](docs/raspberry-pi.md)**.
Mac och PC beskrivs nedan.


---

## Mac

### Det här behövs

- macOS 13 Ventura eller senare, Apple Silicon eller Intel.
- **Google Chrome** (eller Microsoft Edge) om en Stream Deck ska användas. Safari kan visa ställverket
  men saknar WebHID, som Stream Deck behöver.
- Internet under installationen.

### Installera

1. Öppna **Terminal** (Program → Verktygsprogram → Terminal).
2. Kör, **utan** `sudo`:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sh
   ```


3. Installationen tar ett par minuter och öppnar sedan ställverket i ett eget Chrome-fönster.

### Efter installationen

- TKL startar av sig själv när du loggar in och startas om om det skulle stanna.
- Appen **Charlottendal TKL** ligger i mappen **Program i din hemkatalog** (`~/Applications`). Dra den
  till Dock för att ha den nära till hands. Den öppnar ställverket i ett eget fönster i Chrome.
- **Stream Deck:** koppla in den, öppna menyn **⋯ → Stream Deck** och tryck **Anslut** en gång.
  Chrome kommer ihåg valet, och därefter kopplas den upp av sig själv varje gång.
- **TrainMeet:** menyn **⋯ → Tidtabeller → TrainMeet**. Ge datorn ett eget **TKL-id** under
  **Redigera anslutning** (till exempel `cda-tkl-mac`) innan du parkopplar; TrainMeet släpper bara in
  ett TKL per id och station.

### Uppdatera

Kör installationsraden igen. Inställningar och driftdata ligger kvar; svarar den nya versionen inte
inom 40 sekunder återställs den föregående automatiskt.

### Var allt ligger

| Del | Var |
|---|---|
| Program, Node.js och versioner | `~/Library/Application Support/Charlottendal TKL/` (`current` pekar på versionen som används) |
| Inställningar | `~/Library/Application Support/Charlottendal TKL/app.env` |
| Driftdata | `~/Library/Application Support/Charlottendal TKL/state/` |
| Logg | `~/Library/Application Support/Charlottendal TKL/logs/tkl.log` |
| Autostart | `~/Library/LaunchAgents/se.beahead.cda-tkl.plist` |
| App | `~/Applications/Charlottendal TKL.app` |

### Felsökning

```sh
launchctl print gui/$(id -u)/se.beahead.cda-tkl | head -20
tail -50 ~/Library/Application\ Support/Charlottendal\ TKL/logs/tkl.log
```

Starta om: `launchctl kickstart -k gui/$(id -u)/se.beahead.cda-tkl`.

Port 8910 används redan (till exempel av en utvecklingskopia som startats med `npm start`): stoppa
den andra kopian; bara en TKL kan lyssna på porten.

### Avinstallera

```sh
launchctl bootout gui/$(id -u)/se.beahead.cda-tkl
rm -f ~/Library/LaunchAgents/se.beahead.cda-tkl.plist
rm -rf ~/Applications/Charlottendal\ TKL.app
rm -rf ~/Library/Application\ Support/Charlottendal\ TKL
```

Den sista raden tar även bort driftdata och inställningar.

---

## PC (Windows 10/11)

### Det här behövs

- Windows 10 eller 11, 64-bitars (x64 eller ARM).
- **Microsoft Edge** (finns i Windows) eller Google Chrome. Båda har WebHID för Stream Deck.
- Internet under installationen. Inga administratörsrättigheter behövs.

### Installera

1. Öppna **PowerShell** (Start → skriv *PowerShell* → Windows PowerShell). Inte som administratör.
2. Kör:

   ```powershell
   irm https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.ps1 | iex
   ```


3. Installationen tar ett par minuter och öppnar sedan ställverket i ett eget Edge-fönster.

Om Windows Defender SmartScreen eller brandväggen frågar: TKL lyssnar bara på den egna datorn
(127.0.0.1), så ingen öppning i brandväggen behövs.

### Efter installationen

- TKL startar dolt när du loggar in (genväg i mappen *Autostart*) och startas om om det stannar.
- Genvägen **Charlottendal TKL** på skrivbordet öppnar ställverket i ett eget fönster i Edge eller Chrome.
- **Stream Deck:** koppla in den, öppna menyn **⋯ → Stream Deck** och tryck **Anslut** en gång.
  Webbläsaren kommer ihåg valet, och därefter kopplas den upp av sig själv. Stäng Elgatos egen
  Stream Deck-app om den är installerad; bara ett program åt gången kan styra Stream Deck.
- **TrainMeet:** som på Mac; ge datorn ett eget TKL-id, till exempel `cda-tkl-pc`.

### Uppdatera

Kör installationsraden igen i PowerShell. Inställningar och driftdata ligger kvar; svarar den nya
versionen inte inom 40 sekunder återställs den föregående automatiskt.

### Var allt ligger

| Del | Var |
|---|---|
| Program, Node.js och versioner | `%LOCALAPPDATA%\Charlottendal TKL\` (`current.txt` anger versionen som används) |
| Inställningar | `%LOCALAPPDATA%\Charlottendal TKL\app.env` |
| Driftdata | `%LOCALAPPDATA%\Charlottendal TKL\state\` |
| Logg | `%LOCALAPPDATA%\Charlottendal TKL\logs\tkl.log` |
| Autostart | `Charlottendal TKL.lnk` i `shell:startup` |
| Genväg | `Charlottendal TKL.lnk` på skrivbordet |

### Felsökning

Öppna loggen: tryck Windows+R, skriv `%LOCALAPPDATA%\Charlottendal TKL\logs` och öppna `tkl.log`.

Starta om TKL: logga ut och in igen, eller kör i PowerShell:

```powershell
Get-CimInstance Win32_Process | Where-Object CommandLine -like "*Charlottendal TKL*" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process "$([Environment]::GetFolderPath('Startup'))\Charlottendal TKL.lnk"
```

### Avinstallera

```powershell
Get-CimInstance Win32_Process | Where-Object CommandLine -like "*Charlottendal TKL*" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item "$([Environment]::GetFolderPath('Startup'))\Charlottendal TKL.lnk", "$([Environment]::GetFolderPath('Desktop'))\Charlottendal TKL.lnk" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Charlottendal TKL"
```

Den sista raden tar även bort driftdata och inställningar.

---

## Gemensamt

- **Simulator.** Alla installationer kör mot den inbyggda anläggningssimulatorn; statusraden visar
  `● SIMULERING`. Riktig anläggning via LocoBuffer kopplas in i driftsättningssteget.
- **Ingen inloggning.** TKL svarar bara på datorn själv och kräver därför ingen inloggning.
- **En TKL per dator.** Alla använder portarna 8910–8912.
- **Säkerhetskopia.** Kopiera katalogen med driftdata (`state`) och `app.env` medan TKL är stoppat.

## Provat

| Plattform | Hur |
|---|---|
| Raspberry Pi | Debian 12 arm64 med systemd i container: ny installation, uppdatering och återställning efter en trasig version. |
| Mac | På en Mac med Apple Silicon: installation till en testkatalog, start för hand och under launchd, och omstart av launchd efter att processen dödats. |
| PC | Skriptens syntax kontrollerad med PowerShell 7.6. **Inte provat på en Windows-dator.** |
