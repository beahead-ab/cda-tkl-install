#!/bin/sh
# Public installer for Charlottendal TKL on a Raspberry Pi 5 (Raspberry Pi OS 64-bit),
# another Debian/Ubuntu machine, or a Mac:
#
#   curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sudo sh   (Linux)
#   curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sh        (Mac)
#
# It fetches the whole package from GitHub and runs the installer for this system.
# Run it again, or `sudo cda-tkl-update`, to update; settings and operating data stay.
# CDA_TKL_TOKEN=<token> reads the package from a private repository instead (forks).
# CDA_TKL_SOURCE=/path/to/package.tar.gz or a directory installs from there instead (tests).
set -eu

REPOSITORY="beahead-ab/cda-tkl-install"
BRANCH="${CDA_TKL_BRANCH:-main}"
INSTALLER="scripts/install-raspberry-pi.sh"
TEMP_DIR=$(mktemp -d)
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT INT TERM

case "$(uname -s)" in
  Darwin)
    # The Mac installation is per user (Application Support and a launchd agent in the
    # user's own session); through sudo it would install everything for root instead.
    INSTALLER="scripts/install-mac.sh"
    if [ "$(id -u)" -eq 0 ]; then
      echo "Kör installationen utan sudo på Mac:"
      echo "  curl -fsSL https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/install.sh | sh"
      exit 1
    fi
    ;;
  Linux)
    if [ "$(id -u)" -ne 0 ]; then
      echo "Kör installationen med sudo:"
      echo "  curl -fsSL https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/install.sh | sudo sh"
      exit 1
    fi
    command -v curl >/dev/null 2>&1 || { apt-get update && apt-get install -y curl ca-certificates; }
    ;;
  *)
    echo "På Windows installeras TKL från PowerShell; se docs/installation.md."
    exit 1
    ;;
esac

SOURCE="${CDA_TKL_SOURCE:-}"
if [ -n "$SOURCE" ] && [ -d "$SOURCE" ]; then
  SOURCE_DIR="$SOURCE"
else
  ARCHIVE="$TEMP_DIR/cda-tkl.tar.gz"
  if [ -n "$SOURCE" ]; then
    cp "$SOURCE" "$ARCHIVE"
  else
    echo "Hämtar Charlottendal TKL …"
    if [ -n "${CDA_TKL_TOKEN:-}" ]; then
      URL="https://api.github.com/repos/${REPOSITORY}/tarball/${BRANCH}"
      set -- -H "Authorization: Bearer ${CDA_TKL_TOKEN}" -H "Accept: application/vnd.github+json"
    else
      URL="https://github.com/${REPOSITORY}/archive/refs/heads/${BRANCH}.tar.gz"
      set --
    fi
    if ! curl -fsSL "$@" "$URL" -o "$ARCHIVE"; then
      echo
      echo "Kunde inte hämta Charlottendal TKL från GitHub."
      echo "Kontrollera internetanslutningen, och att CDA_TKL_TOKEN är satt om förrådet är privat."
      exit 1
    fi
  fi
  tar -xzf "$ARCHIVE" -C "$TEMP_DIR"
  SOURCE_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)
fi

if [ -z "${SOURCE_DIR:-}" ] || [ ! -f "$SOURCE_DIR/$INSTALLER" ]; then
  echo "Installationspaketet saknar $INSTALLER."
  exit 1
fi
export CDA_TKL_TOKEN="${CDA_TKL_TOKEN:-}" CDA_TKL_BRANCH="$BRANCH"
sh "$SOURCE_DIR/$INSTALLER" "$SOURCE_DIR"
