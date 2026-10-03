# Installera Charlottendal TKL på en Raspberry Pi 5

Den här anvisningen tar dig från en tom Raspberry Pi 5 till ett fristående ställverk: TKL och
anläggningssimulatorn startar av sig själva, ställverket visas i helskärm på Pi:ns skärm och en
Stream Deck kopplas upp utan att någon behöver klicka. Själva installationen är en rad i
terminalen; resten sker automatiskt.

**Innehåll**

1. [Det här behövs](#1-det-här-behövs)
2. [Förbered minneskortet](#2-förbered-minneskortet)
3. [Första start](#3-första-start)
4. [Installera TKL](#4-installera-tkl)
5. [Starta om och kontrollera](#5-starta-om-och-kontrollera)
6. [Koppla till TrainMeet](#6-koppla-till-trainmeet)
7. [Stream Deck](#7-stream-deck)
8. [Använda ställverket](#8-använda-ställverket)
9. [Uppdatera](#9-uppdatera)
10. [Nå Pi:n från en annan dator](#10-nå-pin-från-en-annan-dator)
11. [Säkerhetskopiera](#11-säkerhetskopiera)
12. [Felsökning](#12-felsökning)
13. [Avinstallera](#13-avinstallera)
14. [Vad installationen gör](#14-vad-installationen-gör)
15. [Begränsningar](#15-begränsningar)

---

## 1. Det här behövs

| Sak | Rekommendation |
|---|---|
| Dator | Raspberry Pi 5 med 4 GB eller 8 GB minne |
| Ström | Den officiella strömadaptern för Pi 5, 27 W USB-C (5 V, 5 A). En svagare adapter ger varningar och kan strypa USB-portarna, vilket märks på Stream Deck. |
| Kylning | Den officiella aktiva kylaren (Active Cooler). Chromium i helskärm belastar processorn hela tiden. |
| Lagring | microSD-kort, minst 32 GB, klass A2. Bättre: en NVMe-SSD med M.2-HAT, som tål mer skrivning. |
| Skärm | Valfri HDMI-skärm via micro-HDMI. Ställverket är ritat för 1920 × 1080 men anpassar sig till andra storlekar. |
| Tangentbord och mus | Behövs vid installationen. I drift räcker mus eller pekskärm. |
| Nätverk | Ethernet eller Wi-Fi med internet under installationen. I drift behövs nätet bara för TrainMeet. |
| Stream Deck | Valfri. Elgato Stream Deck med bildknappar (MK.2, XL, Mini, Neo, +). |

Installationen hämtar Node.js och Chromium från internet. Räkna med 5–10 minuter på en Pi 5.

## 2. Förbered minneskortet

1. Ladda ned och starta **Raspberry Pi Imager** på en annan dator: <https://www.raspberrypi.com/software/>.
2. Välj **Raspberry Pi 5** som enhet.
3. Välj operativsystemet **Raspberry Pi OS (64-bit)**, alltså versionen *med* skrivbord. Lite-versionen
   saknar skrivbord och kan inte visa ställverket på skärmen.
4. Välj minneskortet eller SSD:n.
5. När Imager frågar om inställningar, välj **Redigera inställningar** och fyll i:
   - **Värdnamn:** till exempel `cda-tkl`. Pi:n nås då som `cda-tkl.local` på nätet.
   - **Användarnamn och lösenord:** till exempel `pi` och ett eget lösenord.
   - **Wi-Fi:** nätverksnamn och lösenord, och land `SE`. Hoppa över om Pi:n ska ha nätverkskabel.
   - **Tidszon:** `Europe/Stockholm`, tangentbord `se`.
   - Under fliken **Tjänster:** slå på **SSH** med lösenord.
6. Skriv kortet och sätt det i Pi:n.

## 3. Första start

Anslut skärm, tangentbord, mus och nätverk, och sist strömmen. Första starten tar någon minut;
Pi:n startar om en gång av sig själv och visar sedan skrivbordet.

Öppna **Terminal** (ikonen i menyraden överst), eller logga in från en annan dator:

```sh
ssh pi@cda-tkl.local
```

Byt `pi` och `cda-tkl` mot det användarnamn och värdnamn du valde.

## 4. Installera TKL

Kör den här raden i terminalen på Pi:n:

```sh
curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sudo sh
```

Ange ditt lösenord när `sudo` frågar. Installationen skriver vad den gör och avslutar med:

```text
Charlottendal TKL 0.47.0 är installerad och startar automatiskt.
Ställverket:  http://127.0.0.1:8910  (på den här datorn)
Anläggningssimulatorn:  http://127.0.0.1:8911
Chromium öppnar ställverket i helskärm efter nästa omstart:  sudo reboot
Genvägen 'Charlottendal TKL' finns på skrivbordet. Stream Deck kopplas upp av sig själv.
Uppdatera senare med:  sudo cda-tkl-update
```


## 5. Starta om och kontrollera

```sh
sudo reboot
```

Efter omstarten loggar Pi:n in på skrivbordet av sig själv och Chromium öppnar ställverket i
helskärm, med CHARLOTTENDAL överst till vänster. TKL kör mot den inbyggda anläggningssimulatorn.
Tappar ställverket kontakten med anläggningen står det "Ingen kontakt med anläggningen" bredvid namnet.

Kontrollera vid behov i terminalen:

```sh
systemctl status cda-tkl cda-tkl-simulator
```

Båda ska stå som `active (running)`.

## 6. Koppla till TrainMeet

Tidtabellen, träffklockan och tågklareringen kommer från TrainMeet Server. Koppla Pi:n så här:

1. Öppna menyn **⋯** uppe till vänster i ställverket och välj **Tidtabeller → TrainMeet**.
2. Tryck **Redigera anslutning**:
   - **Server:** till exempel `https://server.trainmeet.app`, eller adressen till träffens egen
     TrainMeet Server på det lokala nätet.
   - **TKL-id:** ge Pi:n ett eget id, till exempel `cda-tkl-pi`. TrainMeet släpper bara in ett TKL
     per id och station; om webbdriften eller en annan dator redan är kopplad som Charlottendal med
     samma id kopplas den bort när Pi:n parkopplas.
3. Spara, tryck **Parkoppla**, välj **Charlottendal** i stationslistan och skriv in koden som
   TrainMeet Server visar (sex tecken, till exempel `123-456`).

Inom några sekunder visas tidtabellen i nederraden och klockan går i takt med träffen.

## 7. Stream Deck

Koppla in Stream Deck i en av de blå USB 3-portarna. Ställverket kopplar upp den av sig själv,
både när Pi:n startar och när Stream Deck kopplas in senare. Ingen dialog behövs, eftersom
installationen har sagt åt Chromium att ställverket får använda Elgatos enheter.

- Flera deck kan sitta i samtidigt, till exempel ett XL och två MK.2. Varje deck känns igen på sitt
  serienummer och visar sin egen layout.
- Knapparna visar plupparna och driftknapparna med samma färger som på skärmen.
- **Koppla bort** under menyn **Stream Deck** gör att decken förblir bortkopplade på den här Pi:n
  tills man väljer **Anslut** igen.
- Layouten för varje deck redigeras under **Stream Deck → Layout**. Under **Alla deck** visar **Visa
  vilket deck** namnet på deckets knappar, och **Exportera** och **Importera …** flyttar en layout
  som fil från en annan dator.

## 8. Använda ställverket

- **Helskärm.** Chromium visar bara ställverket, utan adressrad och flikar. Stängs fönstret öppnas
  det igen efter två sekunder. Genvägen **Charlottendal TKL** på skrivbordet gör samma sak.
- **Storlek.** Dra i linjen mellan ställverket och tidtabellen för att ändra fördelningen;
  dubbelklicka för standardläget. Valet sparas på Pi:n.
- **Uppdatering.** `● Uppdatering X` i statusraden betyder att en ny version finns att installera, se
  avsnitt 9. `● Ny version · ladda om` betyder att den redan är installerad och att fönstret ska
  laddas om.
- **Skärmen släcks aldrig.** Installationen stänger av skärmsläckaren.
- **Lämna helskärmen tillfälligt** (till exempel för att nå skrivbordet): logga in med ssh och kör
  `pkill -f cda-tkl-browser; pkill chromium`. Vid nästa omstart är helskärmen tillbaka.

## 9. Uppdatera

När en ny version finns visar statusraden `● Uppdatering 0.49.0` (blå). Tryck på den och välj
**Uppdatera nu**: Pi:n hämtar versionen, installerar den och startar om TKL, vilket tar ett par
minuter. När den är klar visar statusraden `● Ny version · ladda om`; tryck på det. Pi:n tittar efter
nya versioner när den startar och sedan var sjätte timme, och läser då bara versionsnumret i det
publika förrådet.

Samma sak från terminalen:

```sh
sudo cda-tkl-update
```

Den senaste versionen hämtas och installeras på samma sätt som första gången. Inställningar och
driftdata ligger kvar. Den nya versionen läggs i en egen katalog och tas i bruk först när den
svarar; svarar den inte inom 30 sekunder återställs den föregående automatiskt. De tre senaste
versionerna sparas.

Gå tillbaka till en tidigare version för hand:

```sh
ls /opt/cda-tkl/releases
sudo ln -sfn /opt/cda-tkl/releases/VERSION /opt/cda-tkl/current
sudo systemctl restart cda-tkl-simulator cda-tkl
```

Att köra installationsraden igen fungerar också som uppdatering.

## 10. Nå Pi:n från en annan dator

TKL svarar bara på Pi:n själv (127.0.0.1) och kräver därför ingen inloggning. Från en annan dator
på samma nät når man ställverket genom en ssh-tunnel:

```sh
ssh -L 8910:127.0.0.1:8910 -L 8911:127.0.0.1:8911 pi@cda-tkl.local
```

Låt fönstret vara öppet och öppna <http://localhost:8910> (ställverket) och
<http://localhost:8911> (anläggningssimulatorn) i webbläsaren på den andra datorn.

## 11. Säkerhetskopiera

Driftdata och inställningar ligger i två kataloger:

```sh
sudo tar -czf ~/cda-tkl-backup-$(date +%F).tgz /var/lib/cda-tkl /etc/cda-tkl
```

Återställ på en nyinstallerad Pi:

```sh
sudo systemctl stop cda-tkl cda-tkl-simulator
sudo tar -xzf ~/cda-tkl-backup-DATUM.tgz -C /
sudo systemctl start cda-tkl-simulator cda-tkl
```

## 12. Felsökning

| Symtom | Gör så här |
|---|---|
| Installationen avbryts med "Kunde inte hämta" | Kontrollera internet (`ping -c1 github.com`). |
| Ingen helskärm efter omstart | Kör `cat ~/.config/labwc/autostart`; raden `/usr/local/bin/cda-tkl-browser &` ska finnas. Pi:n måste använda skrivbordet labwc (standard i Raspberry Pi OS från hösten 2024): `sudo raspi-config` → Advanced Options → Wayland → labwc. |
| Ställverket svarar inte | `systemctl status cda-tkl` och `journalctl -u cda-tkl -n 50`. |
| "Ingen kontakt med anläggningen" eller anläggningen är tom | `systemctl status cda-tkl-simulator` och `journalctl -u cda-tkl-simulator -n 50`. |
| Stream Deck kopplas inte upp | Dra ur och sätt i den igen. Kontrollera att regeln finns: `cat /etc/udev/rules.d/50-cda-tkl-streamdeck.rules`, och att Chromium har policyn: öppna `chrome://policy` och leta efter `WebHidAllowDevicesForUrls`. Prova en annan USB-port eller en strömförsörjd USB-hubb. |
| Varning om strömförsörjning (blixt i hörnet) | Använd den officiella 27 W-adaptern. |
| Tidtabellen kommer inte | Se **Tidtabeller → TrainMeet**. "Parkopplingen gäller inte längre" betyder att ett annat TKL med samma TKL-id har kopplats; ge Pi:n ett eget id och parkoppla igen. |

Loggarna följs live med `journalctl -fu cda-tkl`.

## 13. Avinstallera

```sh
sudo systemctl disable --now cda-tkl cda-tkl-simulator
sudo rm -f /etc/systemd/system/cda-tkl.service /etc/systemd/system/cda-tkl-simulator.service /etc/systemd/system/cda-tkl-update.service
sudo rm -f /usr/local/sbin/cda-tkl-update /usr/local/bin/cda-tkl-browser
sudo rm -f /etc/udev/rules.d/50-cda-tkl-streamdeck.rules /etc/chromium/policies/managed/cda-tkl.json /etc/chromium-browser/policies/managed/cda-tkl.json
sudo rm -rf /opt/cda-tkl
sed -i '/cda-tkl-browser/d;/Charlottendal TKL/d' ~/.config/labwc/autostart
rm -f ~/Desktop/Charlottendal-TKL.desktop
sudo systemctl daemon-reload
```

Driftdata och inställningar tas bort med `sudo rm -rf /var/lib/cda-tkl /etc/cda-tkl` och
användaren med `sudo userdel cda-tkl`. Gör det bara om du inte vill återinstallera med samma data.

## 14. Vad installationen gör

| Del | Var |
|---|---|
| Node.js 22, hämtad från nodejs.org och kontrollerad mot dess kontrollsumma | `/opt/cda-tkl/node`; systemets egen Node rörs inte |
| Programmet, en katalog per installation | `/opt/cda-tkl/releases/<version>-<tid>`; `/opt/cda-tkl/current` pekar på den som används |
| Inställningar, skrivs en gång och behålls vid uppdatering | `/etc/cda-tkl/app.env` |
| Driftdata | `/var/lib/cda-tkl` |
| Ställverket | tjänsten `cda-tkl`, port 8910, användaren `cda-tkl` |
| Anläggningssimulatorn | tjänsten `cda-tkl-simulator`, port 8911 (webb) och 8912 (LocoNet över TCP) |
| Helskärm | `/usr/local/bin/cda-tkl-browser`, startas från `~/.config/labwc/autostart` |
| Genväg | `Charlottendal-TKL.desktop` på skrivbordet |
| Stream Deck | udev-regeln `/etc/udev/rules.d/50-cda-tkl-streamdeck.rules` och Chromium-policyn `cda-tkl.json` |
| Uppdatering | `/usr/local/sbin/cda-tkl-update`, tjänsten `cda-tkl-update` och polkit-regeln `/etc/polkit-1/rules.d/50-cda-tkl-update.rules`, som låter TKL starta just den tjänsten från ställverket |
| Skrivbordet | automatisk inloggning, labwc, ingen skärmsläckare (via `raspi-config`) |

Alla portar lyssnar bara på `127.0.0.1`. Tjänsterna körs utan rätt att ändra något utanför
`/var/lib/cda-tkl`.

Inställningar i `/etc/cda-tkl/app.env` som kan vara värda att ändra:

| Inställning | Betydelse |
|---|---|
| `CHARLOTTENDAL_TRAINMEET_ORIGIN` | Låser TrainMeet-servern, så att den inte kan ändras i ställverket. |
| `CHARLOTTENDAL_PORT` | Ställverkets port (8910). Ändras den måste helskärmsstarten och Chromium-policyn ändras också. |

Starta om efter en ändring: `sudo systemctl restart cda-tkl`.

## 15. Begränsningar

- **Riktig anläggning.** Installationen kör mot anläggningssimulatorn. LocoNet via LocoBuffer på
  USB (`scripts/locobuffer-gateway.mjs`) kopplas in i driftsättningssteget, när MGP-underlaget finns.
- **Åtkomst från iPad eller annan dator** utan ssh-tunnel kräver inloggning och läggs till när det
  behövs.
- **TrainMeet Server på samma Pi** går bra; de använder olika portar (8787 och 1883 mot 8910–8912).
  Båda installationerna öppnar då var sitt helskärmsfönster.
- **Provat** i en Debian 12-container på arm64 (samma processorarkitektur som Pi 5) med systemd: ny
  installation, uppdatering ovanpå och återställning efter en trasig version. På en riktig Pi 5 med
  skärm och Stream Deck är installationen inte provad än.
