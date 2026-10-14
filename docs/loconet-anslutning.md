# LocoNet ansluten eller ej ansluten

Sedan 0.79.0 (Caspers beslut 11 oktober) har TKL inget simuleringsläge. **Trafiken kommer från trafikspelet på en
TrainMeet-server**, vilken som helst: server.trainmeet.app, en server lokalt eller en annan i molnet. Den väljs och
parkopplas under Inställningar → TrainMeet. Utan server är TKL offline för trafik; inställningarna går att göra ändå.

**LocoNet** är ett eget val, med en knapp:

| Läge | Vad som händer |
|---|---|
| **Ej ansluten** (från början) | TKL väntar inte på LocoNet. Det du gör på panelen räknas som utfört och TKL ger sig själv återrapporten: en växel rapporterar det läge den fick order om, en signal det besked den fick. **Trafikspelets tåg kör TKL längs tågvägarna**, så att spåren blir belagda, tågen syns med sina nummer och tågvägen löses upp när tåget har kommit fram. Inget går ut på LocoNet. Automaten finns bara här. |
| **Ansluten** | *Anslut till LocoNet*: TKL styr banan över en LocoBuffer på USB, som TKL själv startar gatewayen för (`scripts/locobuffer-gateway.mjs`, port 8913). Återrapporterna kommer från banan; tågen är de riktiga. |

Kärnan, låsningen och reglerna är desamma i båda lägena; bara förbindelsen byts. Internt heter lägena `live` och
`offline` (i `connection.json` och API:t).

**Publicerad: 0.80.0** (13 oktober; cda-tkl main `a503d09`, #60; `beahead-ab/cda-tkl-install` main `5133be9`). Läget
och LocoBuffern är oförändrade sedan 0.79.0. Nytt i 0.80.0 är tidtabellens stil, som fungerar likadant i båda lägena
(se nedan).

## Trafikspelets tåg utan LocoNet

`src/traffic-trains.mjs` läser TrainMeet-kontexten varje sekund och ställer ut det som trafikspelet säger finns:

- **På väg hit på linjen:** en sträcka som är belagd mot stationen, med tågnummer (grannstationen har anmält avgång).
  Tåget ställs utanför infartssignalen på linjens infartsspår enligt Orter och telefon (spåret vars TrainMeet-station är
  grannstationen). Spårningen ger det numret från TrainMeet.
- **Uppställt här:** ett tåg som anmälts *uppställt* eller *förare på plats* på ett spår. Det ställs på spåret med samma
  namn (tidtabellens 1a = Spår 1a på panelen) och får sitt nummer.

Sedan kör tåget när en tågväg från där det står är lagd och signalerna visar kör, stannar på målspåret och kör vidare på
nästa tågväg; ut på en linje lämnar det stationen. Ett tåg som redan syns ställs inte ut igen, och ett belagt spår
väntar. Klarering, avgång och ankomst anmäler operatören i TrainMeet som vanligt. TKL:s egen *Simulerad trafik* (tåg med
påhittade nummer) finns inte längre.

Tåget körs av TKL:s egen återrapport (`src/field.mjs` i den lokala processen `src/simulator.mjs`). Dess sida, med
spårledningar att klicka i och fel att lägga in, nås för felsökning från Studio → Driftsättning → *Egen återrapport ↗*.

## Tidtabellen i båda lägena (0.80.0)

Tidtabellen läser bara TrainMeet, aldrig LocoNet, och ser likadan ut vare sig LocoNet är ansluten eller inte. Under
Inställningar → Utseende och ljud väljs hur den visar tågen: Ord, Symboler, Linjebild eller Linjebild + symboler.
Linjebilden ritar linjen in och linjen ut som TrainMeet säger: begärd, klar, belagd med tåget ute på linjen, eller
avklarad. Ett tåg som är anmält inne (ankommet, uppställt eller förare på plats) får en ram runt spåret.

Grannarnas sidor i linjebilden kommer från samma Orter och telefon som infartsspåren för trafikspelets tåg: en ort
kopplad till en TrainMeet-station ger stationen sin linjes sida (C och A vänster, B och D höger). En granne utan
koppling får inget infartsspår, så TKL ställer inte ut dess tåg, och i linjebilden ritas den mittemot tågets andra ände
(eller till vänster om ingen sida är känd).

Med LocoNet ej ansluten följer tidtabellen och planen varandra, eftersom TKL ställer ut och kör trafikspelets tåg efter
samma uppgifter. Med LocoNet ansluten är tågen de riktiga: ramen runt spåret betyder att tåget är anmält inne i
TrainMeet, inte att banan har rapporterat det där.

## Var läget syns och byts

- **Statusraden** har lägesknappen bredvid CHARLOTTENDAL: **LocoNet ansluten** (grön), **LocoNet svarar inte** (röd:
  ansluten men ingen kontakt med banan) eller **LocoNet ej ansluten** (gul). Ett klick öppnar rutan *LocoNet* med båda
  lägena, villkoret och knappen *Anslut till LocoNet* eller *Koppla från LocoNet*. Rangerarens station ser läget men
  byter det inte.
- **Inställningar → Banan (LocoNet)** har samma knapp och kortet *LocoBuffer*: enheten (de USB-serieportar som hittas,
  helst ett namn under `/dev/serial/by-id/`), hastigheten (57 600 baud) och flödeskontrollen (RTS/CTS för LocoBuffer-USB),
  och gatewayens läge och senaste fel. LocoBuffern ställer ägaren eller en administratör in.

**Valet gäller efter omstart.** Var LocoNet ansluten före ett strömavbrott ansluter TKL igen av sig själv; anslutningen
ändras bara när någon trycker på knappen. Utan sparat val är LocoNet ej ansluten.

## Villkor för bytet

Bytet kräver att inga tågvägar ligger, att programmeringsspåret är i normaldrift, att ingen rangerbegäran ligger och
att ingen telegraminspelning pågår: låsen gäller den bana som lämnas. *Anslut till LocoNet* kräver dessutom en inställd
LocoBuffer.

Vid bytet ansluter kärnan på nytt mot den andra förbindelsen, som vid en omstart: signalerna går till stopp,
programmeringsreläet till normalläge, spårledningarna frågas av (kända efter ungefär nio sekunder) och växlarna är
okända tills de får en order (MGP-korten upprepar inga rapporter; TKL frågar av ingångarna var 15:e sekund). Bytet står
i Händelser.

TKL byter aldrig läge av sig självt. Försvinner LocoBuffern medan LocoNet är ansluten visar lägesknappen
**LocoNet svarar inte**, alla fältlägen blir okända och TKL startar gatewayen igen, allt glesare upp till var 15:e
sekund, tills LocoBuffern svarar eller någon kopplar från.

## Var LocoNet kan anslutas

- **Raspberry Pi:** ja. Tjänsten `cda-tkl` ingår i gruppen `dialout` (sedan 0.78.0) för att nå serieporten.
- **Mac:** ja, med LocoBuffern som `/dev/cu.usbserial-…` eller `/dev/cu.usbmodem…`.
- **Windows:** inte än; serieporten läses med POSIX-verktyg.
- **Webbdriften (Render):** nej, den har ingen LocoNet; TKL svarar alltid själv.

Med `CHARLOTTENDAL_CONNECTION_MODE=hardware` (den fristående vägen, `npm run backend` mot en egen gateway) ansluter TKL
till en gateway som någon annan startat på `CHARLOTTENDAL_WIRE_HOST`/`CHARLOTTENDAL_WIRE_PORT`. Då är LocoNet alltid
ansluten.

## Prov

- `test/connection-mode.test.mjs`: läget, LocoBufferns värden, gatewayen som startas, stoppas och startas om, fallbacken
  till ej ansluten, den fristående gatewayen, enhetslistan.
- `test/simulated-trains.test.mjs`: trafikspelets tåg (på linjen och uppställda, aldrig två gånger, nytt försök, inget
  när LocoNet är ansluten) och ett tåg som ställs på ett spår och kör ut.
- `test/tracking-integration.mjs`: TKL, den egna återrapporten och en TrainMeet-server som processer; tåg 421 från
  Kungsfors ställs ut, körs in med sitt nummer och tågvägen löses upp; med automaten kör stationen tåget in och ut.
- `test/live-offline-integration.mjs`: en virtuell LocoBuffer på en pty med en bana bakom som svarar som MGP-korten;
  ej ansluten, bytet nekas med en tågväg, ansluten med avfrågning, stopp och en tågväg ute på LocoNet, och tillbaka utan
  trafik på LocoNet.
