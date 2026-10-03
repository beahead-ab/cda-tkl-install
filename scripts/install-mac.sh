#!/bin/sh
# Installs Charlottendal TKL on a Mac for the logged-in user: its own Node 22, the
# signal box and the LocoNet simulator as a launchd agent that starts at login and
# restarts if it stops, and the app "Charlottendal TKL" that opens the panel in Chrome.
# Called by install.sh (without sudo) with the unpacked package as its argument.
# Running it again updates; the settings and operating data are kept.
set -eu

if [ "$(id -u)" -eq 0 ]; then echo "Kör installationen utan sudo på Mac."; exit 1; fi
SOURCE_DIR=$(CDPATH= cd -- "${1:-$(dirname -- "$0")/..}" && pwd)
[ -f "$SOURCE_DIR/src/server.mjs" ] || { echo "Installationspaketet är ofullständigt."; exit 1; }
APP="${CDA_TKL_HOME:-$HOME/Library/Application Support/Charlottendal TKL}"
NODE_DIR="$APP/node"
NODE_MAJOR=22
LABEL=se.beahead.cda-tkl
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -n 1)
echo "Installerar Charlottendal TKL $VERSION …"
mkdir -p "$APP/releases" "$APP/state" "$APP/logs"

case "$(uname -m)" in arm64) NODE_ARCH=arm64 ;; x86_64) NODE_ARCH=x64 ;; *) echo "Processorn $(uname -m) stöds inte."; exit 1 ;; esac
CURRENT_NODE=$("$NODE_DIR/bin/node" -p 'process.versions.node' 2>/dev/null || true)
if [ "${CURRENT_NODE%%.*}" != "$NODE_MAJOR" ]; then
  echo "Hämtar Node.js $NODE_MAJOR …"
  TMP=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  FILE=$(awk -v a="darwin-${NODE_ARCH}.tar.gz" '$2 ~ a"$" {print $2; exit}' "$TMP/SHASUMS256.txt")
  [ -n "$FILE" ] || { echo "Hittade ingen Node.js $NODE_MAJOR för darwin-$NODE_ARCH."; exit 1; }
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | shasum -a 256 -c -)
  rm -rf "$NODE_DIR.new" && mkdir -p "$NODE_DIR.new"
  tar -xzf "$TMP/$FILE" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR" && mv "$NODE_DIR.new" "$NODE_DIR" && rm -rf "$TMP"
fi

RELEASE="$APP/releases/$VERSION-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RELEASE"
for item in package.json package-lock.json public src scripts profiles; do
  [ -e "$SOURCE_DIR/$item" ] && cp -R "$SOURCE_DIR/$item" "$RELEASE/"
done
echo "Installerar beroenden …"
(cd "$RELEASE" && PATH="$NODE_DIR/bin:$PATH" npm ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error)
"$NODE_DIR/bin/node" --check "$RELEASE/src/server.mjs"
PREVIOUS=$(readlink "$APP/current" 2>/dev/null || true)
ln -sfn "$RELEASE" "$APP/current"
ls -1dt "$APP"/releases/*/ 2>/dev/null | tail -n +4 | while read -r old; do [ "${old%/}" = "$RELEASE" ] || rm -rf "$old"; done

if [ ! -f "$APP/app.env" ]; then
  sed "s|^CHARLOTTENDAL_STATE_DIR=.*|CHARLOTTENDAL_STATE_DIR=$APP/state|" "$SOURCE_DIR/packaging/raspberry-pi/app.env" > "$APP/app.env"
fi
cp "$SOURCE_DIR/packaging/mac/run.sh" "$APP/run.sh" && chmod +x "$APP/run.sh"

# The app that opens the panel: Chrome (WebHID for the Stream Deck), else the default browser.
mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/Charlottendal TKL.app"
osacompile -o "$HOME/Applications/Charlottendal TKL.app" "$SOURCE_DIR/packaging/mac/open-panel.applescript" >/dev/null

if [ -n "${CDA_TKL_NO_LAUNCHD:-}" ]; then
  echo "Startas inte (CDA_TKL_NO_LAUNCHD). Starta för hand med:  \"$APP/run.sh\""
  exit 0
fi
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|@RUN@|$APP/run.sh|" -e "s|@LOGS@|$APP/logs|g" -e "s|@LABEL@|$LABEL|" "$SOURCE_DIR/packaging/mac/launchd.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
ok=false
for _ in $(seq 1 40); do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:8910/api/config 2>/dev/null; then ok=true; break; fi
  sleep 1
done
if [ "$ok" != true ]; then
  echo "TKL svarar inte. Loggen finns i: $APP/logs"
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$APP/current" && rm -rf "$RELEASE"
    launchctl kickstart -k "gui/$(id -u)/$LABEL" || true
    echo "Föregående version är återställd: $PREVIOUS"
  fi
  exit 1
fi
echo
echo "Charlottendal TKL $VERSION är installerad och startar när du loggar in."
echo "Ställverket:  http://127.0.0.1:8910   Anläggningssimulatorn:  http://127.0.0.1:8911"
echo "Appen 'Charlottendal TKL' finns i mappen Program i din hemkatalog."
echo "Uppdatera senare genom att köra installationsraden igen."
open "$HOME/Applications/Charlottendal TKL.app" 2>/dev/null || true
