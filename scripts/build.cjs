'use strict';
// Builds one page per language from the multilingual sources in src/.
// English lives at the site root, the others under /de/, /nl/ and /ja/.
// Usage: node scripts/build.cjs          write the pages
//        node scripts/build.cjs --check  fail if the committed pages are out of date
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://rusttalk.com';
const LANGS = ['en', 'de', 'nl', 'ja'];
const LOCALE = { en: 'en_US', de: 'de_DE', nl: 'nl_NL', ja: 'ja_JP' };
// Files that exist once at the root and are shared by every language.
const SHARED = /^(img\/|favicon\.svg|legal\.css|lang\.js|impressum\.html|datenschutz\.html)/;

const PAGES = {
  'index.html': {
    path: '',
    title: {
      en: 'RustTalk – Your conversations. Your server. Your data.',
      de: 'RustTalk – Deine Gespräche. Dein Server. Deine Daten.',
      nl: 'RustTalk – Jouw gesprekken. Jouw server. Jouw data.',
      ja: 'RustTalk – あなたの会話。あなたのサーバー。あなたのデータ。',
    },
    description: {
      en: 'RustTalk: free, end-to-end encrypted voice, video and text chat you run yourself. No accounts, no ads, no tracking.',
      de: 'RustTalk: kostenloser, Ende-zu-Ende-verschlüsselter Voice-, Video- und Text-Chat, den du selbst betreibst. Keine Accounts, keine Werbung, kein Tracking.',
      nl: 'RustTalk: gratis, end-to-end versleutelde spraak-, video- en tekstchat die je zelf draait. Geen accounts, geen advertenties, geen tracking.',
      ja: 'RustTalkは、自分で運用する無料のエンドツーエンド暗号化された音声・ビデオ・テキストチャットです。アカウント登録なし、広告なし、トラッキングなし。',
    },
  },
  'roadmap.html': {
    path: 'roadmap.html',
    title: { en: 'Roadmap – RustTalk', de: 'Roadmap – RustTalk', nl: 'Roadmap – RustTalk', ja: 'ロードマップ – RustTalk' },
    description: {
      en: 'What RustTalk already does and what is planned next.',
      de: 'Was RustTalk schon kann und was als Nächstes geplant ist.',
      nl: 'Wat RustTalk al kan en wat er hierna gepland is.',
      ja: 'RustTalkでできることと、今後の予定。',
    },
  },
};

const dir = lang => (lang === 'en' ? '' : lang + '/');
const url = (lang, page) => SITE + '/' + dir(lang) + PAGES[page].path;
const href = (from, to, page) => (from === 'en' ? '' : '../') + dir(to) + PAGES[page].path || './';
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Removes every element whose data-l is another language, with its whole line when it stands alone.
function strip(html, lang) {
  const open = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\sdata-l="([a-z]+)"[^>]*>/g;
  let out = '', pos = 0, m;
  while ((m = open.exec(html))) {
    if (m[2] === lang) continue;
    const tag = m[1].toLowerCase();
    const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
    re.lastIndex = open.lastIndex;
    let depth = 1, t;
    while (depth && (t = re.exec(html))) depth += t[1] ? -1 : 1;
    if (depth) throw new Error('unclosed <' + tag + '> at ' + m.index);
    let start = m.index, end = re.lastIndex;
    const lineStart = html.lastIndexOf('\n', start - 1) + 1;
    if (/^[ \t]*$/.test(html.slice(lineStart, start)) && html[end] === '\n') { start = lineStart; end += 1; }
    out += html.slice(pos, start);
    pos = end;
    open.lastIndex = end;
  }
  return out + html.slice(pos);
}

// Inline scripts may only run when their SHA-256 is listed. Styles stay inline (style attributes
// are used), so they are not hashed. frame-ancestors only works as a header (see Caddyfile).
function csp(html) {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>|<script id="[a-z-]+">([\s\S]*?)<\/script>/g)]
    .map(m => "'sha256-" + crypto.createHash('sha256').update(m[1] ?? m[2], 'utf8').digest('base64') + "'");
  return [
    "default-src 'none'",
    'script-src ' + (hashes.length ? [...new Set(hashes)].join(' ') : "'none'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

function replaceOnce(html, re, value, what) {
  if (!re.test(html)) throw new Error('missing ' + what);
  return html.replace(re, value);
}

const SWITCH_SCRIPT = `<script>
(function(){
  // Remember an explicit choice. The English pages forward to the saved or browser language.
  var links=document.querySelectorAll('.lang a');
  links.forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('lang',a.dataset.set)}catch(e){}})});
  if(document.documentElement.lang!=='en')return;
  var want=null;try{want=localStorage.getItem('lang')}catch(e){}
  want=want||(navigator.language||'').toLowerCase().slice(0,2);
  for(var i=0;i<links.length;i++){if(links[i].dataset.set===want&&want!=='en'){location.replace(links[i].href+location.hash);return}}
})();
</script>`;

function render(src, page, lang) {
  const meta = PAGES[page];
  let html = strip(src, lang);
  html = replaceOnce(html, /<html lang="en"/, `<html lang="${lang}"`, 'html lang');
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(meta.title[lang])}</title>`, 'title');
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.description[lang])}">`, 'description');
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(meta.description[lang])}">`);
  const head = [
    `<link rel="canonical" href="${url(lang, page)}">`,
    ...LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${url(l, page)}">`),
    `<link rel="alternate" hreflang="x-default" href="${url('en', page)}">`,
    `<meta property="og:url" content="${url(lang, page)}">`,
    `<meta property="og:locale" content="${LOCALE[lang]}">`,
  ].join('\n');
  html = replaceOnce(html, /(<meta name="viewport"[^>]*>\n)/, `$1${head}\n`, 'viewport meta');
  html = replaceOnce(html, /<script src="lang\.js\?v=\d+"><\/script>/, SWITCH_SCRIPT, 'lang.js include');
  if (lang !== 'en') {
    html = html.replace(/\b(href|src)="([^"]+)"/g, (all, attr, v) => (SHARED.test(v) ? `${attr}="../${v}"` : all));
    html = html.replace(/\bsrcset="([^"]+)"/g, (all, list) =>
      'srcset="' + list.split(/,\s*/).map(c => (SHARED.test(c) ? '../' + c : c)).join(', ') + '"');
  }
  html = html.replace(/<button type="button" data-set="([a-z]+)">([^<]*)<\/button>/g, (all, l, label) =>
    `<a href="${href(lang, l, page)}" data-set="${l}" hreflang="${l}" lang="${l}"${l === lang ? ' class="on" aria-current="page"' : ''}>${label}</a>`);
  html = html.replace(/^<!doctype html>\n/i, `<!doctype html>\n<!-- Generated from src/${page} by scripts/build.cjs. Edit the source, then run make build. -->\n`);
  html = replaceOnce(html, /(<meta charset="utf-8">\n)/, `$1<meta http-equiv="Content-Security-Policy" content="${csp(html)}">\n`, 'charset meta');
  return html;
}

function sitemap() {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const page of Object.keys(PAGES)) {
    for (const lang of LANGS) {
      lines.push('  <url>', `    <loc>${url(lang, page)}</loc>`);
      for (const l of LANGS) lines.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, page)}"/>`);
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${url('en', page)}"/>`, '  </url>');
    }
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

function outputs() {
  const files = {};
  for (const page of Object.keys(PAGES)) {
    const src = fs.readFileSync(path.join(ROOT, 'src', page), 'utf8').replace(/\r\n/g, '\n');
    for (const lang of LANGS) files[dir(lang) + page] = render(src, page, lang);
  }
  files['sitemap.xml'] = sitemap();
  files['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`;
  return files;
}

module.exports = { outputs, strip, render, csp, LANGS, PAGES };

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale = [];
  for (const [name, content] of Object.entries(outputs())) {
    const file = path.join(ROOT, name);
    if (check) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
      if (current !== content) stale.push(name);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
  if (stale.length) {
    console.error('Out of date, run make build: ' + stale.join(', '));
    process.exit(1);
  }
}
