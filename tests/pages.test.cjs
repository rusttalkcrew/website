'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { outputs, strip, LANGS, PAGES } = require('../scripts/build.cjs');

const files = outputs();
const pages = Object.keys(PAGES).flatMap(page => LANGS.map(lang => ({ page, lang, name: (lang === 'en' ? '' : lang + '/') + page })));

test('every page and language is generated', () => {
  for (const { name } of pages) assert.ok(files[name], name);
  assert.ok(files['sitemap.xml'] && files['robots.txt']);
});

test('each page holds only its own language', () => {
  for (const { name, lang } of pages) {
    const html = files[name];
    assert.match(html, new RegExp(`<html lang="${lang}"`), name);
    for (const other of LANGS.filter(l => l !== lang)) assert.ok(!html.includes(`data-l="${other}"`), `${name} contains ${other}`);
    assert.ok(!html.includes('lang.js'), `${name} still loads lang.js`);
  }
});

test('canonical and hreflang links point at every language', () => {
  for (const { name, page, lang } of pages) {
    const html = files[name];
    const self = 'https://rusttalk.com/' + (lang === 'en' ? '' : lang + '/') + PAGES[page].path;
    assert.ok(html.includes(`<link rel="canonical" href="${self}">`), name);
    for (const l of [...LANGS, 'x-default']) assert.match(html, new RegExp(`<link rel="alternate" hreflang="${l}" href="https://rusttalk.com/`), `${name} ${l}`);
    assert.equal((html.match(/class="on" aria-current="page"/g) || []).length, 1, name);
  }
});

test('pages under a language folder load shared files from the root', () => {
  for (const { name, lang } of pages.filter(p => p.lang !== 'en')) {
    const html = files[name];
    assert.ok(!/\b(?:href|src)="(?:img\/|favicon\.svg|legal\.css|impressum\.html|datenschutz\.html)/.test(html), name);
  }
});

test('strip removes nested elements of other languages and keeps the rest', () => {
  const src = '<p>\n  <span data-l="en">A <span>x</span></span><span data-l="de">B <span>y</span></span>\n  <p data-l="de">gone</p>\n</p>\n';
  assert.equal(strip(src, 'en'), '<p>\n  <span data-l="en">A <span>x</span></span>\n</p>\n');
  assert.throws(() => strip('<p data-l="de">open', 'en'));
});

test('every inline script is allowed by its own hash, nothing else runs', () => {
  const crypto = require('node:crypto');
  for (const { name } of pages) {
    const html = files[name];
    const policy = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];
    assert.ok(policy, name + ' has a CSP');
    assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<script'), name + ' CSP comes first');
    const scriptSrc = policy.split('; ').find(d => d.startsWith('script-src '));
    assert.ok(!/unsafe|'self'|https?:/.test(scriptSrc), name + ' script-src only hashes');
    assert.ok(policy.includes("connect-src 'self'") && policy.includes("default-src 'none'"), name);
    for (const m of html.matchAll(/<script(?: id="[a-z-]+")?>([\s\S]*?)<\/script>/g)) {
      const hash = "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'";
      assert.ok(scriptSrc.includes(hash), name + ' script allowed');
    }
    assert.ok(!/<script[^>]*\ssrc=/.test(html), name + ' loads no script file');
  }
});

test('screenshots offer WebP with the PNG as fallback, also under language folders', () => {
  const fs = require('node:fs');
  for (const { name, lang, page } of pages.filter(p => p.page === 'index.html')) {
    const html = files[name], up = lang === 'en' ? '' : '../';
    const sets = [...html.matchAll(/<source type="image\/webp" srcset="([^"]+)"/g)].map(m => m[1]);
    assert.equal(sets.length, 5, name);
    for (const set of sets) for (const c of set.split(', ')) {
      const file = c.split(' ')[0];
      assert.ok(file.startsWith(up + 'img/'), name + ' ' + file);
      assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', file.replace(/^\.\.\//, ''))), file + ' exists');
    }
    assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1, name + ' hero first');
  }
});
