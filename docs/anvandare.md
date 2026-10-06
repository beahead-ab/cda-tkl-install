# Användare och inloggning

Charlottendal TKL har samma användarhantering som TrainMeet Server, funktionellt självständig: ägare och
administratörer med användarnamn och lösenord, inbjudan med engångskod, sessioner i en cookie.
Ägaren lägger till och tar bort användare; en administratör sköter hela TKL men inte vilka som har tillgång.

## Vad som kräver inloggning

| Läge | Operatören (panelen, tågvägar, AIS, klockan, TrainMeet-rörelser) | Inställningar, Objekt och regler, deras API |
|---|---|---|
| Lokalt (ingen `CHARLOTTENDAL_AUTH_MODE`; Pi, Mac, PC) | ingen inloggning | ägare eller administratör, så snart en ägare finns |
| Webbdriften (`CHARLOTTENDAL_AUTH_MODE=password`) | inloggning krävs överallt | inloggning krävs överallt |
| `cloudflare` | JWT-vakten som förut | JWT-vakten som förut |

Vilka vägar som räknas som administration står i `src/auth.mjs` (`isAdminRoute`): Objekt och regler, AI-tjänsten,
Användare, driftbindningar, inspelningar, uppdatering, visningsinställningar, orter, anteckningar och TrainMeets
anslutning. Allt annat är operatörens. Innan den första ägaren finns är allt öppet lokalt, så att Kom igång kan
skapa ägaren; i webbdriften skapas ägaren på servern.

## Ägare, administratörer och inbjudan

- **Ägaren** skapas en gång: lokalt i Kom igång eller på inloggningssidan ("Skapa ägaren"); i webbdriften med
  `printf '%s\n' "$PASSWORD" | node scripts/create-owner.mjs <namn>` som användaren `charlottendal`.
- **Inbjudan.** Under Inställningar → Den här datorn → Användare skriver ägaren ett användarnamn och väljer roll.
  TKL visar en engångskod `XXXX-XXXX` (utan 0, O, 1 och I) som gäller sju dagar. Den nya användaren öppnar
  inloggningssidan, väljer "Jag har en inbjudningskod" och anger namn, kod och ett eget lösenord. Koden lagras
  bara som hash och fungerar en gång.
- **Ny kod** nollställer användarens lösenord och avslutar dess inloggningar. **Ta bort** loggar ut användaren
  och tar bort kontot. Den sista ägaren kan inte tas bort, och ingen tar bort sig själv.
- **Utelåst ägare:** `node scripts/recover-user.mjs <namn>` på datorn skriver en ny kod.
- **Eget lösenord** byts på `/account` (Byt lösenord i sidomenyn). Bytet avslutar användarens andra sessioner.

Användarnamn har 3–64 tecken (bokstäver, siffror, punkt, bindestreck, understreck) och jämförs utan hänsyn till
versaler. Lösenord har 6–128 tecken.

## Lagring och säkerhet

Användarna ligger i `users.json`: lokalt i driftkatalogen (`CHARLOTTENDAL_STATE_DIR`), i webbdriften bredvid
`CHARLOTTENDAL_AUTH_FILE` i `/var/lib/charlottendal-auth` (gruppen `charlottendal-auth`, TKL skriver, simulatorn
läser; filen har rättighet 0640 och skrivs atomiskt). En äldre `auth.json` med det delade lösenordet blir ägaren
`admin` första gången TKL startar utan `users.json`; filen lämnas orörd.

Lösenord lagras med individuellt salt och scrypt (N=131072, r=8, p=1). Sessionsnycklar är 32 slumpbyte och lagras
som SHA-256-hash; sessioner gäller 12 timmar i en HttpOnly, SameSite=Strict-cookie (`__Host-cda_session` med
Secure i webbdriften, `cda_session` lokalt över http://127.0.0.1). Fem misslyckade försök per minut tillåts totalt,
även över omstart. POST kräver korrekt Origin (webbdriften: den publika adressen; lokalt: datorn själv).
Lösenordsbyte, ny kod och borttagning avslutar berörda sessioner och TKL:s händelseströmmar.

## Provning

`node --test test/users.test.mjs test/auth-policy.test.mjs` provar butiken och åtkomstpolicyn utan processer.
`npm run test:integration` kör webbdriftens flöde mot båda processerna: nekad anonym åtkomst, obligatoriskt första
byte för den migrerade ägaren, fel lösenord, cookies, sessionsåterkallelse, CSRF, beständig session över omstart,
förfallna sessioner och begränsning av gissningar. Testlösenorden gäller enbart temporära testfiler.
