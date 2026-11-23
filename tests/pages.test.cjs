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
