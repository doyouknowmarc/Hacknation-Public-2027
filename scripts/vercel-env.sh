#!/usr/bin/env bash
# Links this repo to a Vercel project and uploads every variable from
# .env.local to production and preview. API keys are stored as sensitive.
# Run it yourself: bash scripts/vercel-env.sh   (asks you to log in once)
# TARGETS=preview bash scripts/vercel-env.sh limits it to one environment.
set -euo pipefail
cd "$(dirname "$0")/.."
VERCEL="npx --yes vercel@latest"
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login
[ -f .vercel/project.json ] || $VERCEL link --yes --project hacknation-sensei
while IFS= read -r line || [ -n "$line" ]; do
  [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
  key="${line%%=*}"; value="${line#*=}"
  # Vercel injects its own VERCEL_* variables (vercel link adds one to .env.local).
  [[ "$key" == VERCEL_* ]] && continue
  sensitive=""; [[ "$key" == *API_KEY* ]] && sensitive="--sensitive"
  for target in ${TARGETS:-production preview}; do
    $VERCEL env rm "$key" "$target" --yes >/dev/null 2>&1 || true
    # --yes applies preview variables to all branches instead of prompting for one.
    printf '%s' "$value" | $VERCEL env add "$key" "$target" $sensitive --yes >/dev/null
  done
  echo "✓ $key"
done < .env.local
echo "Done. Redeploy (or push to GitHub) so the new variables take effect."
