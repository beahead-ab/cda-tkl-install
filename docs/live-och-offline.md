# Live och offline

Sedan 0.78.0 kör TKL i ett av två lägen, och läget byts i panelen utan omstart:

| Läge | Vad TKL styr | Förbindelse |
|---|---|---|
| **Live** | Den riktiga banan: order går till växlarna och signalerna, spårledningarna rapporterar från banan. | LocoNet via en LocoBuffer på USB. TKL startar gatewayen till den själv (`scripts/locobuffer-gateway.mjs`, port 8913). |
| **Offline** | Den simulerade banan (`src/simulator.mjs`). Inget går ut på LocoNet. Simulerad trafik och Automat finns bara här. | Simulatorns lokala ledning (port 8912). |

Kärnan, låsningen och reglerna är desamma i båda lägena; bara förbindelsen byts. Offline används när banan inte
är ansluten: för övning, visning och prov.

## Var läget syns och byts

- **Statusraden** har lägesknappen bredvid CHARLOTTENDAL: **LIVE · LocoNet** (grön), **LIVE · ingen LocoNet** (röd)
  eller **OFFLINE · simulerad bana** (gul). Ett klick öppnar rutan *Live eller offline* med båda lägena, villkoret
  för bytet och knappen *Byt till live* eller *Byt till offline*. Vem som helst vid panelen kan byta; rangerarens
  station ser läget men byter det inte.
- **Inställningar → Banan (LocoNet)** har samma val och kortet *LocoBuffer*: enheten (med de USB-serieportar som
  hittas, helst ett namn under `/dev/serial/by-id/`), hastigheten (57 600 baud) och flödeskontrollen (RTS/CTS för
  LocoBuffer-USB), och gatewayens läge och senaste fel. LocoBuffern ställer ägaren eller en administratör in.

Valet sparas i `connection.json` i tillståndskatalogen och gäller efter omstart. Utan sparat val kör TKL offline.

## Villkor för bytet

Bytet kräver att inga tågvägar ligger, att programmeringsspåret är i normaldrift, att ingen rangerbegäran ligger och
att ingen telegraminspelning pågår: låsen gäller den bana som lämnas. Live kräver dessutom en inställd LocoBuffer.

Vid bytet ansluter kärnan på nytt mot den andra förbindelsen, som vid en omstart: signalerna går till stopp,
programmeringsreläet till normalläge, spårledningarna frågas av (de är kända efter ungefär nio sekunder) och växlarna
är okända tills de får en order (MGP-korten upprepar inga rapporter; TKL frågar av ingångarna var 15:e sekund). Går man till live stängs Simulerad trafik och
Automat av, och tåg som väntar på linjerna tas bort ur de inkommande fälten. Bytet står i Händelser.

TKL byter aldrig läge av sig självt. Försvinner LocoBuffern i live (urkopplad, fel enhet) visar lägesknappen
**LIVE · ingen LocoNet**, alla fältlägen blir okända och TKL startar gatewayen igen, allt glesare upp till var
15:e sekund, tills LocoBuffern svarar eller någon byter till offline.

## Var live finns

- **Raspberry Pi:** ja. Tjänsten `cda-tkl` ingår i gruppen `dialout` (sedan 0.78.0) för att nå serieporten.
- **Mac:** ja, med LocoBuffern som `/dev/cu.usbserial-…` eller `/dev/cu.usbmodem…`.
- **Windows:** inte än; serieporten läses med POSIX-verktyg. TKL kör offline.
- **Webbdriften (Render):** nej, den har ingen LocoNet och kör alltid offline.

Med `CHARLOTTENDAL_CONNECTION_MODE=hardware` (den fristående vägen, `npm run backend` mot en egen gateway) ansluter TKL till en gateway som någon annan startat på
`CHARLOTTENDAL_WIRE_HOST`/`CHARLOTTENDAL_WIRE_PORT`. Då finns ingen simulator att gå offline mot, och läget är låst
till live.

## Prov

`test/connection-mode.test.mjs` (läget, LocoBufferns värden, gatewayen som startas, stoppas och startas om,
fallbacken till offline, den fristående gatewayen, enhetslistan) och `test/live-offline-integration.mjs` (TKL och
simulatorn som riktiga processer, en virtuell LocoBuffer på en pty med en simulerad bana bakom som ekar och svarar som
MGP-korten: offline, bytet nekas med en tågväg, live med avfrågning, stopp och en tågväg ute på LocoNet, tillbaka
till offline utan trafik på LocoNet).
