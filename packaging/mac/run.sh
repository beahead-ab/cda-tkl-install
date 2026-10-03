#!/bin/sh
# Started by launchd at login: reads the settings and runs the signal box and the
# LocoNet simulator from the current release. launchd starts it again if it stops.
APP=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
set -a; . "$APP/app.env"; set +a
cd "$APP/current" || exit 1
exec "$APP/node/bin/node" scripts/start.mjs
