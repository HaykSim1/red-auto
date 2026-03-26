#!/usr/bin/env node
/**
 * Smoke test: GET {base}/v1/health → 200 and { status: "ok" }.
 * Usage: node scripts/smoke-health.mjs https://your-service.up.railway.app
 *    or: SMOKE_URL=https://... npm run smoke:health
 */
const base = process.argv[2] ?? process.env.SMOKE_URL;
if (!base?.trim()) {
  console.error('Usage: node scripts/smoke-health.mjs <baseUrl>');
  console.error('  e.g. node scripts/smoke-health.mjs https://zapchast-api.up.railway.app');
  console.error('  or set SMOKE_URL and run npm run smoke:health');
  process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/v1/health`;
let res;
try {
  res = await fetch(url, { redirect: 'follow' });
} catch (err) {
  console.error(`Fetch failed: ${url}`, err instanceof Error ? err.message : err);
  process.exit(1);
}
let body;
try {
  body = await res.json();
} catch {
  console.error(`Non-JSON response from ${url} (HTTP ${res.status})`);
  process.exit(1);
}

if (!res.ok || body?.status !== 'ok') {
  console.error(`FAIL ${url} → HTTP ${res.status}`, body);
  process.exit(1);
}

console.log(`OK ${url} →`, body);
process.exit(0);
