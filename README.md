# rusttalk.com

Static project website (English, German, Dutch and Japanese; no cookies, no tracking).

| File | Purpose |
|---|---|
| `src/index.html` | Home page source in all languages: features, comparison, downloads, server setup |
| `src/roadmap.html` | Roadmap source in all languages: planned, next release and shipped (update it when a release ships something new) |
| `scripts/build.cjs` | Builds one page per language from `src/` |
| `index.html`, `roadmap.html`, `de/`, `nl/`, `ja/` | Generated pages, one language each. Do not edit, run `make build` |
| `sitemap.xml`, `robots.txt` | Generated sitemap with `hreflang` alternates |
| `impressum.html`, `datenschutz.html` | Legal notice and privacy policy (required in Germany) |
| `legal.css`, `lang.js` | Shared style, and the DE/EN switch for the legal pages |
| `img/` | Screenshots (PNG plus WebP at 1280 and 800 px) and logo PNGs |
| `releases.json`, `scripts/releases.cjs` | Release list for the download pickers, refreshed by the release workflow |
| `Dockerfile`, `Caddyfile` | Container image (Caddy serving the site on plain HTTP, port 8080, security headers). Each generated page carries a CSP with the hashes of its inline scripts |

Download buttons are static `releases/latest/download/RustTalk-<platform>` links to
`rusttalkcrew/rusttalk-next`, so they work without JavaScript. The inline release loader
only fills the version label and the "All files & older versions" pickers: stable `vX.Y.Z`
releases ordered by numeric version, listing the versioned installers
(`rusttalk-<version>-<os>-<arch>.<ext>`) with the SHA-256 from the API's `digest` field.

The page reads `/releases.json` from rusttalk.com, never the GitHub API: the release workflow
runs `scripts/releases.cjs` (stable `vX.Y.Z` releases, versioned installers, name, URL, size and
SHA-256 only) before building the image, also every 30 minutes on a schedule, and only pushes a new
image when the list changed. The committed `releases.json` is a snapshot for local previews.
The page still checks the file: a 2 MiB streamed limit, at most 1000 releases, a 15-second deadline,
exact HTTPS asset URLs in `rusttalkcrew/rusttalk-next`, and no strings become HTML. Errors leave the
static links and the releases-page link.

The server setup steps follow the "Run a server" section of the rusttalk-next README
and `docs/operations.md`. Keep them in sync when those change.

## Languages

Edit only the files in `src/`. Every translated element carries `data-l="en|de|nl|ja"`. `make build` writes one page per language: English at `/`, the others at `/de/`, `/nl/` and `/ja/`, each with only its own text, a canonical link, `hreflang` alternates and its own title and description (set in `scripts/build.cjs`). The language switch is a set of links. The English pages forward to a language the visitor picked before, or to the browser language, so search engines still see English at `/`. CI fails when the generated pages are out of date.

## Offline checks

Run `make test` (Node standard library only). It also checks that the generated pages match `src/`.

## Preview

```bash
docker build -t rusttalk-website .
docker run --rm -p 8080:8080 rusttalk-website
```

Open <http://localhost:8080> (or `/de/`, `/nl/`, `/ja/`). Without Docker, run `make build` and serve the folder, for example with `python -m http.server`.

## Deploy

CI pushes `ghcr.io/rusttalkcrew/website` (`latest` on every push to `main`, plus `<version>` on `v*` tags).
Run it on the server and let the host's Caddy terminate TLS in front of it:

```bash
docker run -d --restart unless-stopped -p 127.0.0.1:8080:8080 ghcr.io/rusttalkcrew/website:latest
```

```caddy
rusttalk.com {
	reverse_proxy 127.0.0.1:8080
}

www.rusttalk.com {
	redir https://rusttalk.com{uri} permanent
}
```

DNS: `rusttalk.com` may be proxied by Cloudflare. A RustTalk server on the same host needs its own **DNS only** record, because the Cloudflare proxy does not forward the media ports (7881/tcp, 7882/udp).

## Screenshots

Take them with neutral names and no private desktop content (e.g. a local dev server with test clients). Keep them around 1100 px wide.
