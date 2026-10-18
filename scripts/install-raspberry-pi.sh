#!/bin/sh
# Installs Charlottendal TKL as a standalone signal box on a Raspberry Pi 5 (or any
# Debian/Ubuntu machine): its own Node 22, TKL and the LocoNet simulator as services,
# the panel full screen in Chromium at start-up, and the Stream Deck usable from the
# panel. Called by install.sh with the unpacked package as its argument. Running it
# again updates the program; /etc/cda-tkl/app.env and /var/lib/cda-tkl are kept.
set -eu

if [ "$(id -u)" -ne 0 ]; then echo "Kör installationen med sudo."; exit 1; fi
SOURCE_DIR=$(CDPATH= cd -- "${1:-$(dirname -- "$0")/..}" && pwd)
# Vilken installation paketet blir (packaging/identity.env): Charlottendal (cda-tkl) om inget annat anges.
TKL_ID=cda-tkl TKL_NAME=Charlottendal TKL_STATION=charlottendal TKL_REPOSITORY=beahead-ab/cda-tkl-install
[ -f "$SOURCE_DIR/packaging/identity.env" ] && . "$SOURCE_DIR/packaging/identity.env"
case "$TKL_ID" in *[!a-z0-9-]*|'') echo "Ogiltigt TKL_ID i packaging/identity.env."; exit 1 ;; esac
if [ ! -f "$SOURCE_DIR/src/server.mjs" ] || [ ! -f "$SOURCE_DIR/packaging/raspberry-pi/cda-tkl.service" ]; then
  echo "Hämtar det fullständiga installationspaketet …"
  exec sh -c "curl -fsSL https://raw.githubusercontent.com/$TKL_REPOSITORY/main/install.sh | sh"
fi
PACKAGING="$SOURCE_DIR/packaging/raspberry-pi"
BASE=/opt/$TKL_ID
STATE_DIR=/var/lib/$TKL_ID
CONFIG_DIR=/etc/$TKL_ID
# Paketfilerna är skrivna för Charlottendal (cda-tkl); för en annan station byts namn, sökvägar och förråd vid installationen.
render() { sed -e "s#beahead-ab/cda-tkl-install#$TKL_REPOSITORY#g" -e "s#cda-tkl#$TKL_ID#g" -e "s#Charlottendal#$TKL_NAME#g" "$1" > "$2"; chmod "$3" "$2"; }
NODE_DIR="$BASE/node"
NODE_MAJOR=22
DESKTOP_USER=${CDA_TKL_DESKTOP_USER:-${SUDO_USER:-}}
# A rangerare's station: only the kiosk browser, pointed at the signal box's Pi, e.g.
# CDA_TKL_KIOSK_URL=http://cda-tkl.local:8910/#ranger. No TKL or simulator runs here.
KIOSK_URL=${CDA_TKL_KIOSK_URL:-}
SYSTEMD=true
[ -d /run/systemd/system ] || SYSTEMD=false
VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -n 1)

echo "Installerar $TKL_NAME TKL $VERSION …"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl xz-utils

# Node.js 22 from nodejs.org, checked against its published checksum, in our own
# directory: the system's Node (if any) is neither used nor changed.
case "$(uname -m)" in
  aarch64|arm64) NODE_ARCH=arm64 ;;
  x86_64|amd64) NODE_ARCH=x64 ;;
  *) echo "Processorn $(uname -m) stöds inte; Raspberry Pi 5 med 64-bitars system krävs."; exit 1 ;;
esac
CURRENT_NODE=$("$NODE_DIR/bin/node" -p 'process.versions.node' 2>/dev/null || true)
if [ "${CURRENT_NODE%%.*}" != "$NODE_MAJOR" ]; then
  echo "Hämtar Node.js $NODE_MAJOR …"
  NODE_TMP=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" -o "$NODE_TMP/SHASUMS256.txt"
  NODE_FILE=$(awk -v a="linux-${NODE_ARCH}.tar.xz" '$2 ~ a"$" {print $2; exit}' "$NODE_TMP/SHASUMS256.txt")
  [ -n "$NODE_FILE" ] || { echo "Hittade ingen Node.js $NODE_MAJOR för linux-$NODE_ARCH."; exit 1; }
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$NODE_FILE" -o "$NODE_TMP/$NODE_FILE"
  (cd "$NODE_TMP" && grep " $NODE_FILE\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf "$NODE_DIR.new" && mkdir -p "$NODE_DIR.new"
  tar -xJf "$NODE_TMP/$NODE_FILE" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR" && mv "$NODE_DIR.new" "$NODE_DIR"
  rm -rf "$NODE_TMP"
fi
NODE="$NODE_DIR/bin/node"

if ! id "$TKL_ID" >/dev/null 2>&1; then
  useradd --system --home-dir "$STATE_DIR" --no-create-home --shell /usr/sbin/nologin "$TKL_ID"
fi
install -d -m 0755 "$BASE" "$BASE/releases"
install -d -o "$TKL_ID" -g "$TKL_ID" -m 0750 "$STATE_DIR"

# Each installation is a release directory of its own; `current` points at the one in
# use, and the two before it are kept to go back to.
RELEASE="$BASE/releases/$VERSION-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RELEASE"
for item in package.json package-lock.json public src scripts profiles stations; do
  [ -e "$SOURCE_DIR/$item" ] && cp -R "$SOURCE_DIR/$item" "$RELEASE/"
done
echo "Installerar beroenden …"
(cd "$RELEASE" && PATH="$NODE_DIR/bin:$PATH" npm ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error)
"$NODE" --check "$RELEASE/src/server.mjs"
chown -R root:root "$RELEASE" && chmod -R a+rX "$RELEASE"
PREVIOUS=$(readlink "$BASE/current" 2>/dev/null || true)
ln -sfn "$RELEASE" "$BASE/current.new" && mv -Tf "$BASE/current.new" "$BASE/current"
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +4 | while read -r old; do
  [ "${old%/}" = "$RELEASE" ] || rm -rf "$old"
done

# Settings: written once, never overwritten by an update.
install -d -m 0755 "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/app.env" ]; then
  render "$PACKAGING/app.env" "$CONFIG_DIR/app.env" 0644
fi
# En annan station än Charlottendal: stationen, förrådet för uppdateringar och Pi:ns uppdateringstjänst.
if [ "$TKL_STATION" != charlottendal ]; then
  grep -q '^CHARLOTTENDAL_STATION=' "$CONFIG_DIR/app.env" || printf '\nCHARLOTTENDAL_STATION=%s\n' "$TKL_STATION" >> "$CONFIG_DIR/app.env"
fi
if [ "$TKL_REPOSITORY" != beahead-ab/cda-tkl-install ]; then
  grep -q '^CHARLOTTENDAL_INSTALL_REPOSITORY=' "$CONFIG_DIR/app.env" || printf 'CHARLOTTENDAL_INSTALL_REPOSITORY=%s\n' "$TKL_REPOSITORY" >> "$CONFIG_DIR/app.env"
fi
if [ "$TKL_ID" != cda-tkl ]; then
  grep -q '^CHARLOTTENDAL_UPDATE_UNIT=' "$CONFIG_DIR/app.env" || printf 'CHARLOTTENDAL_UPDATE_UNIT=%s-update.service\n' "$TKL_ID" >> "$CONFIG_DIR/app.env"
fi
# Older installations lack the setting that turns on the update notice.
grep -q '^CHARLOTTENDAL_INSTALL_KIND=' "$CONFIG_DIR/app.env" || printf '\nCHARLOTTENDAL_INSTALL_KIND=raspberry-pi\n' >> "$CONFIG_DIR/app.env"
if [ -n "$KIOSK_URL" ]; then
  sed -i '/^CHARLOTTENDAL_KIOSK_URL=/d' "$CONFIG_DIR/app.env" && printf 'CHARLOTTENDAL_KIOSK_URL=%s\n' "$KIOSK_URL" >> "$CONFIG_DIR/app.env"
fi
KIOSK_URL=$(sed -n 's/^CHARLOTTENDAL_KIOSK_URL=//p' "$CONFIG_DIR/app.env" | tail -n 1)
KIOSK_ORIGIN=$(printf '%s' "$KIOSK_URL" | sed -E 's#^(https?://[^/]+).*#\1#')
if [ -n "${CDA_TKL_TOKEN:-}" ]; then
  umask 077 && printf '%s\n' "$CDA_TKL_TOKEN" > "$CONFIG_DIR/github-token" && umask 022
fi
# TKL läser token för att se nya versioner i ett privat förråd (Uppdatering i panelen); bara dess grupp får läsa den.
if [ -f "$CONFIG_DIR/github-token" ]; then
  chown "root:$TKL_ID" "$CONFIG_DIR/github-token" && chmod 0640 "$CONFIG_DIR/github-token"
  grep -q '^CHARLOTTENDAL_GITHUB_TOKEN_FILE=' "$CONFIG_DIR/app.env" || printf 'CHARLOTTENDAL_GITHUB_TOKEN_FILE=%s\n' "$CONFIG_DIR/github-token" >> "$CONFIG_DIR/app.env"
fi

install -d -m 0755 /etc/systemd/system /usr/local/sbin /usr/local/bin
render "$PACKAGING/cda-tkl.service" "/etc/systemd/system/$TKL_ID.service" 0644
render "$PACKAGING/cda-tkl-simulator.service" "/etc/systemd/system/$TKL_ID-simulator.service" 0644
render "$PACKAGING/cda-tkl-update.service" "/etc/systemd/system/$TKL_ID-update.service" 0644
render "$PACKAGING/cda-tkl-update" "/usr/local/sbin/$TKL_ID-update" 0755
render "$PACKAGING/cda-tkl-browser" "/usr/local/bin/$TKL_ID-browser" 0755
# The panel may start the update service, and only that (polkit).
if [ -d /etc/polkit-1/rules.d ] || command -v pkcheck >/dev/null 2>&1; then
  install -d -m 0755 /etc/polkit-1/rules.d
  render "$PACKAGING/50-cda-tkl-update.rules" "/etc/polkit-1/rules.d/50-$TKL_ID-update.rules" 0644
fi

# Stream Deck: the logged-in desktop user may open it (udev), and Chromium lets the
# panel use it without the "choose a device" dialog (policy), so it connects by itself.
# Katalogen finns på Raspberry Pi OS men inte på varje Debian/Ubuntu utan udev.
install -d -m 0755 /etc/udev/rules.d
render "$PACKAGING/50-cda-tkl-streamdeck.rules" "/etc/udev/rules.d/50-$TKL_ID-streamdeck.rules" 0644
if command -v udevadm >/dev/null 2>&1; then udevadm control --reload-rules 2>/dev/null || true; udevadm trigger 2>/dev/null || true; fi
for POLICY_DIR in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  install -d -m 0755 "$POLICY_DIR"
  if [ -n "$KIOSK_ORIGIN" ]; then
    sed "s#\"http://localhost:8910\" ]#\"http://localhost:8910\", \"$KIOSK_ORIGIN\" ]#" "$PACKAGING/chromium-policy.json" > "$POLICY_DIR/$TKL_ID.json" && chmod 0644 "$POLICY_DIR/$TKL_ID.json"
  else
    install -m 0644 "$PACKAGING/chromium-policy.json" "$POLICY_DIR/$TKL_ID.json"
  fi
done

BROWSER_ENABLED=false
if [ -z "$DESKTOP_USER" ] || [ "$DESKTOP_USER" = root ]; then
  DESKTOP_USER=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 65534 {print $1; exit}')
fi
if command -v labwc >/dev/null 2>&1 && [ -n "${DESKTOP_USER:-}" ] && id "$DESKTOP_USER" >/dev/null 2>&1; then
  DESKTOP_HOME=$(getent passwd "$DESKTOP_USER" | cut -d: -f6)
  if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
    apt-get install -y chromium || apt-get install -y chromium-browser
  fi
  AUTOSTART="$DESKTOP_HOME/.config/labwc/autostart"
  install -d -o "$DESKTOP_USER" -g "$DESKTOP_USER" -m 0755 "$DESKTOP_HOME/.config/labwc"
  touch "$AUTOSTART"
  grep -q "$TKL_ID-browser" "$AUTOSTART" || printf '\n# %s TKL\n/usr/local/bin/%s-browser &\n' "$TKL_NAME" "$TKL_ID" >> "$AUTOSTART"
  chown "$DESKTOP_USER:$DESKTOP_USER" "$AUTOSTART"
  DESKTOP_DIR=$(runuser -u "$DESKTOP_USER" -- xdg-user-dir DESKTOP 2>/dev/null || true)
  DESKTOP_DIR=${DESKTOP_DIR:-$DESKTOP_HOME/Desktop}
  install -d -o "$DESKTOP_USER" -g "$DESKTOP_USER" -m 0755 "$DESKTOP_DIR"
  render "$PACKAGING/cda-tkl.desktop" "$DESKTOP_DIR/$TKL_NAME-TKL.desktop" 0755 && chown "$DESKTOP_USER:$DESKTOP_USER" "$DESKTOP_DIR/$TKL_NAME-TKL.desktop"
  if command -v raspi-config >/dev/null 2>&1; then
    raspi-config nonint do_wayland W2 || true       # labwc
    raspi-config nonint do_boot_behaviour B4 || true # desktop, logged in automatically
    raspi-config nonint do_blanking 1 || true        # the screen never blanks
  fi
  [ "$SYSTEMD" = true ] && systemctl set-default graphical.target >/dev/null 2>&1 || true
  BROWSER_ENABLED=true
fi

if [ "$SYSTEMD" = true ] && [ -n "$KIOSK_URL" ]; then
  # The rangerare's station shows another Pi's TKL; nothing runs here but the browser.
  systemctl daemon-reload
  systemctl disable --now "$TKL_ID-simulator.service" "$TKL_ID.service" >/dev/null 2>&1 || true
elif [ "$SYSTEMD" = true ]; then
  systemctl daemon-reload
  systemctl enable "$TKL_ID-simulator.service" "$TKL_ID.service" >/dev/null
  # `enable --now` would leave a running old process in place on an update.
  systemctl restart "$TKL_ID-simulator.service" "$TKL_ID.service"
  ok=false
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:8910/api/config 2>/dev/null; then ok=true; break; fi
    sleep 1
  done
  if [ "$ok" != true ]; then
    echo "TKL svarar inte. Visa loggen med:  journalctl -u $TKL_ID -n 50"
    if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
      ln -sfn "$PREVIOUS" "$BASE/current.new" && mv -Tf "$BASE/current.new" "$BASE/current"
      rm -rf "$RELEASE"
      systemctl restart "$TKL_ID-simulator.service" "$TKL_ID.service" || true
      for _ in $(seq 1 30); do curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:8910/api/config 2>/dev/null && break; sleep 1; done
      echo "Föregående version är återställd och körs: $PREVIOUS"
    fi
    exit 1
  fi
else
  echo "Ingen systemd här: tjänsterna är installerade men inte startade."
fi

echo
if [ -n "$KIOSK_URL" ]; then
  echo "Rangerarens station är installerad. Chromium öppnar $KIOSK_URL i helskärm efter omstart:  sudo reboot"
  echo "Logga in med en användare som har rollen rangerare. Stream Deck kopplas upp av sig själv."
  exit 0
fi
echo "$TKL_NAME TKL $VERSION är installerad och startar automatiskt."
echo "Ställverket:  http://127.0.0.1:8910  (på den här datorn)"
echo "Anläggningssimulatorn:  http://127.0.0.1:8911"
if [ "$BROWSER_ENABLED" = true ]; then
  echo "Chromium öppnar ställverket i helskärm efter nästa omstart:  sudo reboot"
  echo "Genvägen '$TKL_NAME TKL' finns på skrivbordet. Stream Deck kopplas upp av sig själv."
else
  echo "Inget skrivbord hittades; TKL körs utan lokal webbläsare."
fi
echo "Uppdatera senare med:  sudo $TKL_ID-update"
