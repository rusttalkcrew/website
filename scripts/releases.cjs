'use strict';
// Writes releases.json: the stable rusttalk-next releases with their versioned installers.
// The home page reads this file from rusttalk.com, so visitors' browsers never call the GitHub API.
// Usage: GITHUB_TOKEN=... node scripts/releases.cjs [output file]   (the token only raises the rate limit)
const fs = require('node:fs');
const path = require('node:path');

const API = 'https://api.github.com/repos/rusttalkcrew/rusttalk-next/releases?per_page=100&page=';
const DOWNLOAD = 'https://github.com/rusttalkcrew/rusttalk-next/releases/download/';
const TAG = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const MAX_RELEASES = 1000;

// Keeps stable vX.Y.Z releases and their rusttalk-<version>-* files, with only the fields the page uses.
function trim(releases) {
  const seen = new Set(), out = [];
  for (const r of releases) {
    if (!r || r.draft !== false || r.prerelease !== false || typeof r.tag_name !== 'string' || !TAG.test(r.tag_name) || seen.has(r.tag_name)) continue;
    seen.add(r.tag_name);
    const prefix = 'rusttalk-' + r.tag_name.slice(1) + '-';
    const assets = (Array.isArray(r.assets) ? r.assets : [])
      .filter(a => a && typeof a.name === 'string' && /^[A-Za-z0-9._-]+$/.test(a.name) && a.name.startsWith(prefix) &&
        a.browser_download_url === DOWNLOAD + r.tag_name + '/' + a.name)
      .map(a => {
        const out = { name: a.name, browser_download_url: a.browser_download_url };
        if (Number.isSafeInteger(a.size) && a.size >= 0) out.size = a.size;
        if (typeof a.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(a.digest)) out.digest = a.digest;
        return out;
      });
    if (assets.length) out.push({ tag_name: r.tag_name, draft: false, prerelease: false, assets });
  }
  const n = t => TAG.exec(t).slice(1, 4).map(BigInt);
  out.sort((a, b) => { const x = n(a.tag_name), y = n(b.tag_name); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? -1 : 1; return 0; });
  if (out.length > MAX_RELEASES) out.length = MAX_RELEASES;
  return out;
}

async function fetchAll() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'rusttalk-website-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(API + page, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error('GitHub API returned HTTP ' + res.status);
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('Unexpected GitHub API answer');
    all.push(...items);
    if (items.length < 100) return all;
  }
  throw new Error('More than 1000 releases');
}

module.exports = { trim, MAX_RELEASES };

if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'releases.json'));
  fetchAll().then(all => {
    const list = trim(all);
    // Fail closed: never replace a working list with an empty one.
    if (!list.length) throw new Error('No stable release with installers found');
    fs.writeFileSync(file, JSON.stringify(list) + '\n');
    console.log(`releases.json: ${list.length} releases, newest ${list[0].tag_name}`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
