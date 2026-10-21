#!/bin/sh
# Uppdaterar installationen på en Mac: kör samma installationsrad som första gången, med den sparade token om
# förrådet är privat. Startas av panelen (Inställningar → Uppdatering → Uppdatera nu), som kör skriptet fristående
# så att det överlever att installeraren stoppar och startar om TKL, eller för hand:
#
#   ~/Library/Application\ Support/<Namn>\ TKL/update.sh
#
# Installeraren gör resten: ny version bredvid den gamla, byte av current, omstart genom launchd, och återställning
# av föregående version om den nya inte svarar. Inställningar och driftdata ligger kvar.
set -eu
APP=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$APP/logs"
exec >>"$APP/logs/update.log" 2>&1
echo "== $(date -u +%Y-%m-%dT%H:%M:%SZ) uppdatering startad"
# Stationens eget installationsförråd om installationen har ett (Tk-TKL för Träkvista), annars Charlottendals.
REPOSITORY=$(sed -n 's/^CHARLOTTENDAL_INSTALL_REPOSITORY=//p' "$APP/app.env" 2>/dev/null | tr -d '"' | tail -n 1)
echo "$REPOSITORY" | grep -Eq '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' || REPOSITORY=beahead-ab/cda-tkl-install
TOKEN=""
[ -r "$APP/github-token" ] && TOKEN=$(tr -d '\r\n' < "$APP/github-token")
URL="https://raw.githubusercontent.com/$REPOSITORY/${CDA_TKL_BRANCH:-main}/install.sh"
if [ -n "$TOKEN" ]; then
  curl -fsSL -H "Authorization: Bearer $TOKEN" "$URL" | CDA_TKL_TOKEN="$TOKEN" sh
else
  curl -fsSL "$URL" | sh
fi
