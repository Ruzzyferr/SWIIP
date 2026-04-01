/**
 * Sanity-check auto-update hosting: latest.yml reachable, version/path parseable, installer URL returns 200.
 * Run from repo: pnpm --filter @constchat/desktop exec node scripts/verify-update-endpoint.mjs
 */
const base = 'https://swiip.app/downloads/';
const ymlUrl = new URL('latest.yml', base);

const ymlRes = await fetch(ymlUrl);
if (!ymlRes.ok) {
  console.error(`verify-update-endpoint: GET ${ymlUrl} failed: ${ymlRes.status}`);
  process.exit(1);
}

const text = await ymlRes.text();
const lines = text.split(/\r?\n/);
const meta = {};
for (const line of lines) {
  const m = /^(\w+):\s*(.+)$/.exec(line.trim());
  if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

if (!meta.version || !meta.path) {
  console.error('verify-update-endpoint: latest.yml missing version or path');
  console.error(text.slice(0, 500));
  process.exit(1);
}

const installerUrl = new URL(meta.path, base);
const head = await fetch(installerUrl, { method: 'HEAD' });
if (!head.ok) {
  console.error(`verify-update-endpoint: installer HEAD ${installerUrl} failed: ${head.status}`);
  console.error(`verify-update-endpoint: yml declares path=${meta.path} — that file must exist beside latest.yml on the server.`);
  process.exit(1);
}

console.log(`verify-update-endpoint: OK — version=${meta.version} path=${meta.path} sha512=${meta.sha512 ? `${meta.sha512.slice(0, 16)}…` : '(missing)'}`);
if (!meta.sha512) {
  console.warn('verify-update-endpoint: warning — sha512 missing in yml; electron-updater expects it for generic provider.');
}
