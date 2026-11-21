#!/usr/bin/env bash
# Lädt die gebauten Ordner dist/win-unpacked und dist/linux-unpacked per SteamPipe hoch.
# Vorher: App- und Depot-IDs eintragen (siehe docs/STEAM.md) und steamcmd installieren.
# Aufruf: STEAM_USER=deinname APP_ID=123 DEPOT_ID_WIN=124 DEPOT_ID_LINUX=125 ./steam/upload.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${STEAM_USER:?STEAM_USER fehlt}" "${APP_ID:?APP_ID fehlt}" "${DEPOT_ID_WIN:?DEPOT_ID_WIN fehlt}" "${DEPOT_ID_LINUX:?DEPOT_ID_LINUX fehlt}"
for d in win-unpacked linux-unpacked; do [ -d "../dist/$d" ] || { echo "dist/$d fehlt – erst npm run dist:steam-win / dist:steam-linux"; exit 1; }; done
mkdir -p build
for f in app_build.vdf depot_win.vdf depot_linux.vdf; do
  sed -e "s/APP_ID/$APP_ID/g" -e "s/DEPOT_ID_WIN/$DEPOT_ID_WIN/g" -e "s/DEPOT_ID_LINUX/$DEPOT_ID_LINUX/g" "$f" > "build/$f"
done
steamcmd +login "$STEAM_USER" +run_app_build "$(pwd)/build/app_build.vdf" +quit
echo "Hochgeladen. Im Steamworks-Backend unter SteamPipe → Builds den Build auf einen Zweig setzen."
