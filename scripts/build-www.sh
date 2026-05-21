#!/usr/bin/env bash
#
# Builds the web bundle that Capacitor wraps into the native app.
# This static site has no build step, so we copy the front-end assets
# into ./www, which is what capacitor.config.json points at as webDir.
#
# Anything that is server-side, tooling, or generated is excluded.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WWW="$ROOT/www"

# Things that must NOT ship inside the native web bundle.
EXCLUDES=(
  ".git"
  "node_modules"
  "ios"
  "www"
  "scripts"
  "netlify"
  "package.json"
  "package-lock.json"
  "capacitor.config.json"
  "debugger.txt"
)

is_excluded() {
  local name="$1"
  for ex in "${EXCLUDES[@]}"; do
    [[ "$name" == "$ex" ]] && return 0
  done
  return 1
}

rm -rf "$WWW"
mkdir -p "$WWW"

shopt -s dotglob
for entry in "$ROOT"/*; do
  base="$(basename "$entry")"
  if is_excluded "$base"; then
    continue
  fi
  cp -R "$entry" "$WWW/"
done
shopt -u dotglob

echo "Built web bundle into $WWW"
