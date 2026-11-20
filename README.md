# rusttalk.com

Static project website (English/German, no build step, no cookies, no tracking).

| File | Purpose |
|---|---|
| `index.html` | Home page: features, screenshots, downloads, server setup |
| `roadmap.html` | Planned, maybe-later and shipped features (update it when a release ships something new) |
| `impressum.html`, `datenschutz.html` | Legal notice and privacy policy (required in Germany) |
| `legal.css`, `lang.js` | Shared style and DE/EN switch for the legal pages |
| `img/` | Screenshots and logo PNGs |
| `Dockerfile`, `Caddyfile` | Container image (Caddy serving the site on plain HTTP, port 8080) |

Download buttons are static `releases/latest/download/RustTalk-<platform>` links to
`rusttalkcrew/rusttalk-next`, so they work without JavaScript. The inline release loader
only fills the version label and the "All files & older versions" pickers: stable `vX.Y.Z`
releases ordered by numeric version, listing the versioned installers
(`rusttalk-<version>-<os>-<arch>.<ext>`) with the SHA-256 from the API's `digest` field.

The browser reads the existing GitHub API (disclosed in `datenschutz.html`), using
at most 10 requests of 100 releases, with a streamed 2 MiB response limit per page
and a 15-second overall deadline. URLs are constructed locally; pagination links
are never followed. Errors or malformed responses leave the static links and the
releases-page link. Listed files must have the exact HTTPS asset URL in
`rusttalkcrew/rusttalk-next`. No API strings become HTML.

The server setup steps follow the "Run a server" section of the rusttalk-next README
and `docs/operations.md`. Keep them in sync when those change.

## Offline checks

Run `make test` (Node standard library only).

## Preview

```bash
docker build -t rusttalk-website .
docker run --rm -p 8080:8080 rusttalk-website
```

Open <http://localhost:8080>. Or open `index.html` directly in a browser.

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
