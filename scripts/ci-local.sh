#!/usr/bin/env bash
# The merge gate, run by Jenkins (Jenkinsfile) and by hand when Jenkins is busy:
# clean install, unit tests, the production static export that
# scripts/deploy-vps.sh ships, then checks on what nginx will serve.
#   bash scripts/ci-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PNPM=(pnpm)
command -v pnpm >/dev/null 2>&1 || PNPM=(corepack pnpm)
SITE="https://ar-menu.devya.dev"
export NEXT_PUBLIC_SITE_URL="$SITE"
export NEXT_TELEMETRY_DISABLED=1

"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" test
"${PNPM[@]}" run build

fail() { echo "ci-local: $*" >&2; exit 1; }
test -f out/index.html && test -f out/print.html && test -f out/404.html || fail "out/ lacks index/print/404"
# Every dish has its pages and both models in the export.
for slug in $(node -p "require('./menu.json').dishes.map(d => d.slug).join(' ')"); do
  test -f "out/dish/$slug.html" || fail "out/dish/$slug.html missing"
  test -f "out/p/$slug.html" || fail "out/p/$slug.html missing"
done
# The printed QR codes must encode the live host, never a Vercel URL.
node -e "
const m = require('./public/qr/manifest.json');
if (m.siteUrl !== '$SITE') { console.error('ci-local: public/qr/manifest.json siteUrl is ' + m.siteUrl); process.exit(1); }
"
! grep -rlE '[a-z0-9-]+\.vercel\.app' out public/qr --include=*.html --include=*.svg --include=*.json >/dev/null \
  || fail "a shipped page or QR names *.vercel.app"
first="$(node -p "require('./menu.json').dishes[0].slug")"
grep -q "$SITE" "out/dish/$first.html" || fail "metadataBase does not use $SITE"
echo "ci-local: all steps passed"
