#!/usr/bin/env bash
set -euo pipefail
if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
  echo 'Application verification unavailable: foundation ticket must add lockfile and real checks.' >&2
  exit 78
fi
npm ci
npm run typecheck
npm run lint
npm test
npm run build
