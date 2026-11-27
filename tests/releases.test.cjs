'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.RUSTTALK_TEST_HTML || __dirname + '/../index.html', 'utf8');
const source = html.match(/<script id="component-releases">([\s\S]*?)<\/script>/)[1];
const context = { module: { exports: {} }, AbortController, setTimeout, clearTimeout, TextDecoder, Uint8Array };
vm.runInNewContext(source, context);
const api = context.module.exports;
const REPO = 'https://github.com/rusttalkcrew/rusttalk-next';
const files = v => ['windows-x86_64.exe', 'windows-aarch64.exe', 'linux-x86_64.AppImage', 'linux-aarch64.AppImage', 'macos-universal.dmg']
  .map(f => 'rusttalk-' + v + '-' + f);
function release(tag, names = files(tag.slice(1)), extra = {}) {
  return { tag_name: tag, draft: false, prerelease: false, assets: names.map(name => ({ name,
    browser_download_url: REPO + '/releases/download/' + tag + '/' + name })), ...extra };
}
const tags = list => Array.from(list, r => r.tag_name);
function response(items, link = null) { return new Response(JSON.stringify(items), { headers: link ? { link } : {} }); }

test('canonical stable vX.Y.Z tags with u64 fields only', () => {
  for (const t of ['v0.0.0', 'v0.1.0', 'v18446744073709551615.0.0']) assert.ok(api.tag(t), t);
  for (const t of ['v01.0.0', 'v1.00.0', 'v1.0.01', 'v18446744073709551616.0.0', 'v1.0.0-rc.1', 'v1.0.0+client.abcdef1',
    '1.0.0', 'v1.0', 'v1.0.0\n', '<script>', null]) assert.equal(api.tag(t), null, String(t));
});

test('history orders numerically and skips drafts, prereleases, bad tags and duplicates', () => {
  const releases = [release('v1.9.0'), release('v1.10.0'), release('v2.0.0', undefined, { draft: true }),
    release('v3.0.0', undefined, { prerelease: true }), release('v4.0.0-rc.1', files('4.0.0')), release('v1.10.0', [])];
  assert.deepEqual(tags(api.history(releases, 'windows')), ['v1.10.0', 'v1.9.0']);
  assert.deepEqual(tags(api.history(releases, 'linux')), ['v1.10.0', 'v1.9.0']);
  assert.deepEqual(tags(api.history(releases, 'macos')), ['v1.10.0', 'v1.9.0']);
});

test('platform files must carry the release version; other assets never qualify', () => {
  const r = release('v1.0.0', [...files('1.0.0'), 'RustTalk-windows-x86_64.exe', 'latest.json', 'latest.json.sig',
    'rusttalk-0.9.0-windows-x86_64.exe', 'rusttalk-1.0.0-windows-x86_64.exe.sha256', 'rusttalk-1.0.0-macos-aarch64.dmg']);
  for (const [kind, expected] of [['windows', ['rusttalk-1.0.0-windows-x86_64.exe', 'rusttalk-1.0.0-windows-aarch64.exe']],
    ['linux', ['rusttalk-1.0.0-linux-x86_64.AppImage', 'rusttalk-1.0.0-linux-aarch64.AppImage']],
    ['macos', ['rusttalk-1.0.0-macos-universal.dmg']]]) {
    const doc = documentFixture(kind);
    api.apply(doc, [r]);
    assert.deepEqual(doc.det.parts['.list'].children[0].children.map(li => li.children[0].children[0].textContent), expected);
  }
  assert.deepEqual(tags(api.history([release('v2.0.0', ['rusttalk-2.0.0-linux-x86_64.AppImage'])], 'windows')), []);
  assert.deepEqual(tags(api.history([release('v2.0.0', ['rusttalk-1.0.0-windows-x86_64.exe'])], 'windows')), []);
  assert.deepEqual(tags(api.history([release('v2.0.0', ['RustTalk-windows-x86_64.exe'])], 'windows')), []);
  assert.deepEqual(tags(api.history([release('v2.0.0', ['RustTalk-macos-universal.dmg'])], 'macos')), []);
  assert.deepEqual(tags(api.history([release('v2.0.0', ['rusttalk-2.0.0-macos-aarch64.dmg'])], 'macos')), []);
});

test('hostile asset URLs and names never qualify', () => {
  const name = 'rusttalk-1.0.0-windows-x86_64.exe';
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://evil.example/file',
    'https://github.com/other/rusttalk-next/releases/download/v1.0.0/' + name,
    'https://github.com/rusttalkcrew/RustTalk/releases/download/v1.0.0/' + name,
    REPO + '/releases/download/v2.0.0/' + name, 'http://github.com/rusttalkcrew/rusttalk-next/releases/download/v1.0.0/' + name]) {
    const r = release('v1.0.0', [name]); r.assets[0].browser_download_url = url;
    assert.equal(api.history([r], 'windows').length, 0, url);
  }
  const r = release('v1.0.0', ['<img onerror=alert(1)>']);
  assert.equal(api.safeAsset(r.assets[0], r), false);
});

test('loads only the same-origin release list, never the GitHub API', async () => {
  const calls = [];
  const result = await api.load(async (url, init) => { calls.push([url, init.credentials, init.redirect]); return response([release('v1.0.0')]); });
  assert.equal(result.length, 1);
  assert.deepEqual(calls, [['/releases.json', 'omit', 'error']]);
  assert.equal(source.includes('api.github.com'), false);
  await assert.rejects(api.load(async () => new Response('', { status: 404 })), /failed/);
});

test('stream byte cap, malformed shape, oversized arrays, broken JSON and invalid UTF-8 refuse', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(api.LIMIT + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(api.readPage({ ok: true, body }), /too large/);
  assert.equal(cancelled, true);
  for (const data of [{}, [null], [{ tag_name: 'v1.0.0' }], Array(api.MAX_RELEASES + 1).fill(release('v1.0.0'))]) await assert.rejects(api.readPage(response(data)));
  await assert.rejects(api.readPage(new Response('{')));
  await assert.rejects(api.readPage(new Response(new Uint8Array([255]))));
});

class Element {
  constructor(name, text = '') { this.name = name; this.textContent = text; this.children = []; this.dataset = {}; this.events = {}; }
  appendChild(e) { this.children.push(e); }
  addEventListener(event, handler) { this.events[event] = handler; }
  querySelector(selector) { return this.parts[selector]; }
}
function documentFixture(kind = 'windows', os = 'windows') {
  const det = new Element('details'); det.dataset.kind = kind;
  det.parts = { '.ver-sel': new Element('select'), '.list': new Element('div', 'fallback') };
  const label = new Element('span');
  return { det, label, documentElement: { dataset: { os } }, createElement: name => new Element(name),
    querySelectorAll: selector => selector === 'details.files' ? [det] : [label] };
}

test('DOM shows version, history, files and SHA-256 from digest; never inserts HTML', () => {
  const doc = documentFixture(), r = release('v1.2.0');
  r.assets[0].digest = 'sha256:' + 'a'.repeat(64);
  r.assets[0].size = 1048576 * 3;
  api.apply(doc, [release('v1.1.0'), r]);
  assert.equal(doc.label.textContent, 'v1.2.0 · ');
  assert.deepEqual(Array.from(doc.det.parts['.ver-sel'].children, o => o.textContent), ['v1.2.0', 'v1.1.0']);
  const items = doc.det.parts['.list'].children[0].children;
  assert.deepEqual(items.map(li => li.children[0].children[0].textContent), ['rusttalk-1.2.0-windows-x86_64.exe', 'rusttalk-1.2.0-windows-aarch64.exe']);
  assert.equal(items[0].children[0].children[0].href, r.assets[0].browser_download_url);
  assert.equal(items[0].children[0].children[1].textContent, '3.0 MB');
  assert.equal(items[0].children[1].children[1].textContent, 'a'.repeat(64));
  assert.equal(items[1].children.length, 1, 'no checksum row without a valid digest');
  assert.equal(source.includes('innerHTML'), false);
});

test('Linux visitors see the Linux version; no releases keep the static fallback', () => {
  const doc = documentFixture('linux', 'linux');
  api.apply(doc, [release('v2.0.0', ['rusttalk-2.0.0-windows-x86_64.exe']), release('v1.0.0')]);
  assert.equal(doc.label.textContent, 'v1.0.0 · ');
  const missing = documentFixture(); api.apply(missing, []);
  assert.equal(missing.det.parts['.list'].textContent, 'fallback');
  assert.equal(missing.label.textContent, '');
});

test('mobile visitors see the newest release with their installable file', () => {
  const mobile = release('v0.2.0', ['rusttalk-0.2.0-android-arm64.apk', 'rusttalk-0.2.0-ios-unsigned.ipa']);
  for (const [os, file] of [['android', 'android-arm64.apk'], ['ios', 'ios-unsigned.ipa']]) {
    const doc = documentFixture(os, os);
    api.apply(doc, [release('v0.2.1'), mobile, release('v0.1.11')]);
    assert.equal(doc.label.textContent, 'v0.2.0 · ');
    const link = doc.det.parts['.list'].children[0].children[0].children[0].children[0];
    assert.equal(link.href, REPO + '/releases/download/v0.2.0/rusttalk-0.2.0-' + file);
  }
});

test('releases.json keeps stable versioned installers with only the fields the page reads', () => {
  const { trim } = require('../scripts/releases.cjs');
  const r = release('v1.2.0', [...files('1.2.0'), 'latest.json', 'RustTalk-windows-x86_64.exe', 'rusttalk-1.1.0-windows-x86_64.exe']);
  r.assets[0].digest = 'sha256:' + 'b'.repeat(64); r.assets[0].size = 5; r.assets[0].uploader = { login: 'x' };
  r.assets[1].digest = 'md5:abc'; r.assets[1].size = -1;
  const out = trim([release('v1.1.0'), r, release('v1.3.0-rc.1', files('1.3.0')), release('v2.0.0', undefined, { draft: true }),
    release('v1.10.0', []), { ...release('v1.0.0'), assets: [{ name: '<x>', browser_download_url: 'javascript:1' }] }]);
  assert.deepEqual(tags(out), ['v1.2.0', 'v1.1.0'], 'newest first, no prerelease, draft, empty or hostile releases');
  assert.deepEqual(out[0].assets.map(a => a.name), files('1.2.0'));
  assert.deepEqual(Object.keys(out[0].assets[0]).sort(), ['browser_download_url', 'digest', 'name', 'size']);
  assert.deepEqual(Object.keys(out[0].assets[1]).sort(), ['browser_download_url', 'name'], 'bad digest and size dropped');
  // The page accepts what the script writes.
  const doc = documentFixture();
  api.apply(doc, JSON.parse(JSON.stringify(out)));
  assert.equal(doc.label.textContent, 'v1.2.0 · ');
});
