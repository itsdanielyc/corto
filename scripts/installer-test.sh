#!/usr/bin/env bash
# L7 on macOS and Linux: open the bundle the way a user would, launch the
# installed app, confirm it stays alive for six seconds, then remove it.
# Linux needs a display: CI runs this script under xvfb-run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bundle="$here/../release"
log="${RUNNER_TEMP:-/tmp}/corto-launch.log"
smoke_root=$(mktemp -d)
trap 'rm -rf "$smoke_root"' EXIT

ok()   { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# The renderer writes a unique marker from the real main process. A temporary
# AppImage path is an implementation detail, not a reliable process identifier.
smoke_launch() {
  local marker="$smoke_root/ready-$RANDOM.json"
  CORTO_SMOKE_OUTPUT="$marker" bash -c "$1" >"$log" 2>&1 &
  local launcher=$!
  for ((attempt=0; attempt<60; attempt++)); do
    [ -s "$marker" ] && break
    sleep 0.25
  done
  if [ ! -s "$marker" ]; then
    cat "$log" || true
    ps -eo pid,ppid,args | grep '[c]orto' || true
    fail "installed app did not finish loading its renderer ($1)"
  fi
  local app_pid
  cat "$marker"; echo
  app_pid=$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1])); if(!r.rendererReady || !r.movieEncoded || !Number.isInteger(r.pid)) process.exit(1); console.log(r.pid)' "$marker")
  sleep 6
  if kill -0 "$app_pid" 2>/dev/null; then
    ok "installed renderer loaded and its main process stayed alive for 6s ($1)"
    kill "$app_pid" 2>/dev/null || true
    sleep 2
  else
    cat "$log" || true
    fail "installed app did not stay alive ($1)"
  fi
  kill "$launcher" 2>/dev/null || true
  wait "$launcher" 2>/dev/null || true
}

case "$(uname -s)" in
  Darwin)
    dmg=$(ls "$bundle"/*.dmg | head -1); [ -f "$dmg" ] || fail "no dmg"
    mnt=$(mktemp -d)
    hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mnt" >/dev/null
    ok "dmg mounted"
    app=$(ls -d "$mnt"/*.app | head -1); [ -d "$app" ] || fail "no .app inside dmg"
    dest="$HOME/Applications"; mkdir -p "$dest"; rm -rf "$dest/Corto.app"
    cp -R "$app" "$dest/Corto.app"
    hdiutil detach "$mnt" >/dev/null; ok "dmg copied to $dest and detached"
    xattr -cr "$dest/Corto.app" || true
    smoke_launch "open -n '$dest/Corto.app' --args --corto-smoke-test"
    rm -rf "$dest/Corto.app"; ok "app removed"
    ;;
  Linux)
    [ -n "${DISPLAY:-}" ] || fail "no DISPLAY; run under xvfb-run"
    deb=$(ls "$bundle"/*.deb | head -1); [ -f "$deb" ] || fail "no deb"
    sudo apt-get install -y "$deb" >/dev/null; ok "deb installed"
    command -v corto >/dev/null || fail "corto not on PATH after deb install"
    smoke_launch "corto --corto-smoke-test"
    sudo apt-get remove -y corto >/dev/null; ok "deb removed"
    command -v corto >/dev/null && fail "corto still on PATH after removal" || ok "corto gone from PATH"
    appimage=$(ls "$bundle"/*.AppImage | head -1); [ -f "$appimage" ] || fail "no AppImage"
    chmod +x "$appimage"
    repetitions="${CORTO_APPIMAGE_REPETITIONS:-1}"
    [[ "$repetitions" =~ ^(1|30)$ ]] || fail "AppImage repetitions must be 1 or 30"
    for ((run=1; run<=repetitions; run++)); do
      echo "AppImage launch $run / $repetitions"
      smoke_launch "'$appimage' --appimage-extract-and-run --corto-smoke-test"
    done
    ;;
  *) fail "unsupported OS" ;;
esac
echo "installer tests passed"
