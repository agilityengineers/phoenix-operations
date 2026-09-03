#!/usr/bin/env bash
# Requires a running API behind the shared proxy (BASE_URL defaults to localhost).
set -euo pipefail
base="${BASE_URL:-http://localhost}"
suffix="$(date +%s)"
a="tenant-a-${suffix}"
b="tenant-b-${suffix}"
jar_a="$(mktemp)"
jar_b="$(mktemp)"
cleanup() { rm -f "$jar_a" "$jar_b"; }
trap cleanup EXIT
json() { curl -fsS "$@"; }

# Bootstrap status is secret-free and invalid bootstrap attempts never succeed.
status="$(json "$base/api/auth/bootstrap/status")"
printf '%s' "$status" | grep -q '"bootstrapRequired":'
! printf '%s' "$status" | grep -Eqi 'token|bootstrapUrl'
if curl -fsS -X POST "$base/api/auth/bootstrap" -H 'content-type: application/json' -d "{\"token\":\"invalid\",\"name\":\"Invalid\",\"email\":\"invalid-$suffix@example.test\",\"password\":\"StrongPassword123\"}" >/dev/null; then
  echo "invalid bootstrap token accepted" >&2; exit 1
fi

# Two independently addressable public workspaces.
custom="$a.customer.test"
json -c "$jar_a" -X POST "$base/api/auth/signup" -H 'content-type: application/json' \
  -d "{\"name\":\"Owner A\",\"email\":\"a-${suffix}@example.test\",\"password\":\"password123\",\"brandName\":\"Tenant A\",\"subdomain\":\"$a\",\"customDomain\":\"$custom\",\"practiceType\":\"Other\"}" >/dev/null
json -c "$jar_b" -X POST "$base/api/auth/signup" -H 'content-type: application/json' \
  -d "{\"name\":\"Owner B\",\"email\":\"b-${suffix}@example.test\",\"password\":\"password123\",\"brandName\":\"Tenant B\",\"subdomain\":\"$b\",\"practiceType\":\"Other\"}" >/dev/null

if curl -fsS -b "$jar_a" -X PATCH "$base/api/workspace" -H 'Origin: https://attacker.example' -H 'Sec-Fetch-Site: cross-site' -H 'content-type: application/json' -d '{"brand":{"primaryColor":"#ff0000"}}' >/dev/null; then
  echo "malicious Origin mutation accepted" >&2; exit 1
fi
json -b "$jar_a" -X PATCH "$base/api/workspace" -H "Origin: $base" -H 'Sec-Fetch-Site: same-origin' -H 'content-type: application/json' -d '{"brand":{"primaryColor":"#123456"}}' >/dev/null

# Public branding/CMS are tenant scoped and admin persistence survives reload.
json "$base/api/public/workspace?workspace=$a" | grep -q '#123456'
json "$base/api/public/workspace?workspace=$b" | grep -vq '#123456'
! json -H "Host: $custom" "$base/api/public/workspace" | grep -q 'Tenant A'
if curl -fsS -X POST "$base/api/auth/signup" -H 'content-type: application/json' -d "{\"name\":\"Bad Domain\",\"email\":\"bad-$suffix@example.test\",\"password\":\"password123\",\"brandName\":\"Bad\",\"subdomain\":\"bad-$suffix\",\"customDomain\":\"evil.replit.app\"}" >/dev/null; then
  echo "reserved platform domain claim accepted" >&2; exit 1
fi
# Replit production hosts map to the default tenant rather than the deployment name.
json -H 'Host: phoenix-port.replit.app' "$base/api/public/workspace" | grep -q '"name":"Phoenix Operations"'
json -b "$jar_a" -X POST "$base/api/cms/toggle" -H 'content-type: application/json' -d '{"pageId":"home","sectionId":"faq","enabled":false}' >/dev/null
json "$base/api/public/cms?workspace=$a" | grep -q '"enabled":false'

# Public leads remain isolated. Parallel writes exercise the row lock.
for n in 1 2 3 4; do
  json -X POST "$base/api/intake/submit?workspace=$a" -H 'content-type: application/json' -d "{\"funnelSlug\":\"lack-of-control\",\"resumeToken\":\"parallel-$n-$suffix\",\"answers\":{\"name\":\"Lead $n\",\"email\":\"lead-$n-$suffix@example.test\"}}" >/dev/null &
done
wait
json -b "$jar_a" "$base/api/contacts/export" | grep -q "lead-1-$suffix@example.test"
! json -b "$jar_b" "$base/api/contacts/export" | grep -q "lead-1-$suffix@example.test"

# Booking uses an opaque single-use capability bound to the submitted session,
# not a public contact id. A guessed/replayed capability must fail.
resume="resume-${suffix}"
submission="$(json -X POST "$base/api/intake/submit?workspace=$a" -H 'content-type: application/json' -d "{\"funnelSlug\":\"lack-of-control\",\"resumeToken\":\"$resume\",\"answers\":{\"name\":\"Bookable\",\"email\":\"book-$suffix@example.test\"}}")"
booking="$(printf '%s' "$submission" | node -e 'let d="";process.stdin.on("data",x=>d+=x).on("end",()=>process.stdout.write(JSON.parse(d).bookingToken))')"
test -n "$booking"
# Simulate the frontend's delayed draft persistence after submit. Server-owned
# booking fields and submitted state must survive this untrusted draft update.
sleep 1
json -X POST "$base/api/intake/session?workspace=$a" -H 'content-type: application/json' -d "{\"funnelSlug\":\"lack-of-control\",\"resumeToken\":\"$resume\",\"step\":5,\"answers\":{\"name\":\"Bookable\",\"email\":\"book-$suffix@example.test\"},\"submitted\":false}" >/dev/null
if curl -fsS -X POST "$base/api/intake/book?workspace=$a" -H 'content-type: application/json' -d "{\"resumeToken\":\"$resume\",\"bookingToken\":\"not-a-token\",\"slot\":\"Mon 9/7 · 9:15 AM\"}" >/dev/null; then
  echo "guessed capability booked a contact" >&2; exit 1
fi
json -X POST "$base/api/intake/book?workspace=$a" -H 'content-type: application/json' -d "{\"resumeToken\":\"$resume\",\"bookingToken\":\"$booking\",\"slot\":\"Mon 9/7 · 9:15 AM\"}" >/dev/null
if curl -fsS -X POST "$base/api/intake/book?workspace=$a" -H 'content-type: application/json' -d "{\"resumeToken\":\"$resume\",\"bookingToken\":\"$booking\",\"slot\":\"Mon 9/7 · 11:30 AM\"}" >/dev/null; then
  echo "replayed capability booked a contact" >&2; exit 1
fi

# A public request cannot access administrative exports.
if curl -fsS "$base/api/contacts/export?workspace=$a" >/dev/null; then
  echo "expected unauthenticated export denial" >&2; exit 1
fi
if curl -fsS -b "$jar_a" "$base/api/partners" >/dev/null; then
  echo "ordinary owner accessed platform partner data" >&2; exit 1
fi
echo "Phoenix tenant, authorization, export, and parallel mutation regression passed."