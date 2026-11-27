#!/usr/bin/env bash
# Production deploy of https://ar-menu.devya.dev (the AR menu demo) to the Devya VPS.
#
# Nothing builds on the VPS. This builds the static export (`output: 'export'`
# -> out/) here from a clean checkout of origin/main, ships it to
# releases/<sha> on the VPS and points `current` at it; nginx serves that
# directory (deploy/nginx/ar-menu.conf), with the exact .usdz/.glb content types.
#
#   bash scripts/deploy-vps.sh           deploy origin/main
#   bash scripts/deploy-vps.sh --setup   also install deploy/nginx/ar-menu.conf and
#                                        issue the TLS certificate (ar-menu.devya.dev
#                                        must already resolve to the VPS)
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

HOST="${DEVYA_VPS:-root@72.61.81.59}"
VPS_IP=72.61.81.59
DIR=/home/devya/projects/ar-menu
DOMAIN=ar-menu.devya.dev
URL="https://$DOMAIN"
KEEP=3
SETUP=0
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=1 ;;
    *) echo "usage: $0 [--setup]" >&2; exit 2 ;;
  esac
done

PNPM=(pnpm)
command -v pnpm >/dev/null 2>&1 || PNPM=(corepack pnpm)

git fetch -q origin main
SHA="$(git rev-parse --short origin/main)"
echo "deploy: ar-menu at origin/main $SHA"

# Build from a clean checkout of origin/main, never from the working tree.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ar-menu-build.XXXXXX")"
trap 'git -C "$ROOT" worktree remove --force "$WORK/src" >/dev/null 2>&1 || true; rm -rf "${WORK:?}"' EXIT
git worktree add -q --detach "$WORK/src" origin/main
cd "$WORK/src"

# Public config only: canonical URL for metadata, hreflang, sitemap and robots.
export NEXT_PUBLIC_SITE_URL="$URL"
export NEXT_TELEMETRY_DISABLED=1
"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" run build
test -f out/index.html && test -f out/print.html \
  || { echo "deploy: out/index.html or out/print.html missing" >&2; exit 1; }

# COPYFILE_DISABLE + --no-xattrs: no macOS ._* files or xattr headers (GNU tar
# on the VPS warns about every one) in the release.
COPYFILE_DISABLE=1 tar --no-xattrs -C out -czf "$WORK/release.tgz" .
echo "deploy: built $(du -h "$WORK/release.tgz" | cut -f1) release"
cd "$ROOT"

ssh -o BatchMode=yes "$HOST" "mkdir -p $DIR/releases/$SHA" </dev/null
ssh -o BatchMode=yes "$HOST" "tar -xzf - -C $DIR/releases/$SHA" < "$WORK/release.tgz"
ssh -o BatchMode=yes "$HOST" "set -e; cd $DIR
  chown -R root:root releases/$SHA
  find releases/$SHA -type d -exec chmod 755 {} +
  find releases/$SHA -type f -exec chmod 644 {} +
  ln -sfn releases/$SHA current.new && mv -T current.new current
  ls -1t releases | tail -n +$((KEEP + 1)) | while read -r old; do rm -rf \"releases/\$old\"; done" </dev/null

if [ "$SETUP" = 1 ]; then
  git show "origin/main:deploy/nginx/ar-menu.conf" | ssh -o BatchMode=yes "$HOST" "set -e
    if [ ! -e /etc/nginx/sites-available/ar-menu ]; then
      cat > /etc/nginx/sites-available/ar-menu
      ln -sf /etc/nginx/sites-available/ar-menu /etc/nginx/sites-enabled/ar-menu
      nginx -t && systemctl reload nginx
    else
      cat >/dev/null
      echo 'deploy: nginx site ar-menu already installed (certbot edits it in place); left as is'
    fi"
  if [ "$(dig +short A "$DOMAIN" @1.1.1.1 | tail -1)" != "$VPS_IP" ]; then
    echo "deploy: $DOMAIN does not resolve to $VPS_IP yet; add the DNS record, then rerun --setup" >&2
    exit 1
  fi
  ssh -o BatchMode=yes "$HOST" "certbot --nginx -n --agree-tos --redirect --cert-name $DOMAIN -d $DOMAIN" </dev/null
fi

# A 200 page is not a working page: every asset it references must load too, and
# the 3D models must carry the content types AR viewers insist on.
status=0
# A dish that has both 3D models in the repo.
slug="$(git ls-tree --name-only origin/main public/models/ | grep '\.usdz$' | head -1 | xargs basename | sed 's/\.usdz$//')"
for path in / /print "/dish/$slug" "/p/$slug"; do
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$URL$path" || true)"
  echo "deploy: $URL$path -> $code"
  [ "$code" = 200 ] || status=1
done
for model in "/models/$slug.usdz:model/vnd.usdz+zip" "/models/$slug.glb:model/gltf-binary"; do
  type="$(curl -s -o /dev/null -m 30 -w '%{content_type}' "$URL${model%%:*}" || true)"
  echo "deploy: $URL${model%%:*} -> $type"
  [ "$type" = "${model#*:}" ] || status=1
done
missing=0 total=0
for asset in $(curl -s -m 20 "$URL/" | grep -oE '(src|href)="/_next/static/[^"]+' | cut -d'"' -f2 | sort -u); do
  total=$((total + 1))
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$URL$asset" || true)"
  [ "$code" = 200 ] || { echo "deploy: $asset -> $code" >&2; missing=$((missing + 1)); }
done
echo "deploy: $URL/ references $total static assets, $missing missing"
[ "$total" -gt 0 ] && [ "$missing" = 0 ] || status=1
exit "$status"
