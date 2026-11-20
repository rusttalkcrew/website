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

Download buttons default to the GitHub releases page. The inline release loader resolves exact
assets from stable client/server or legacy combined releases, ordered by numeric
version. Build metadata does not affect order; component tags take precedence over
same-version legacy tags. Ambiguous component versions refuse discovery before
asset filtering. Index-server releases do not qualify. History menus show only
releases containing files for their component and platform; checksums remain visible.

The browser reads the existing GitHub API (disclosed in `datenschutz.html`), using
at most 10 requests of 100 releases, with a streamed 2 MiB response limit per page
and a 15-second overall deadline. URLs are constructed locally; pagination links
are never followed. Incomplete pagination, malformed responses, errors, ambiguity
or missing assets leave safe releases-page links. Downloads accept only exact
HTTPS asset URLs in `rusttalkcrew/RustTalk`. No API strings become HTML.

The server setup example deliberately asks users to choose a stable server or
combined release and download its Linux archive before unpacking. It does not
assume the repository-wide latest release contains a server.

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

DNS: `rusttalk.com` may be proxied by Cloudflare. A RustTalk voice server on the same host needs its own **DNS only** record, because the Cloudflare proxy does not forward port 7331 or UDP.

## Screenshots

Take them with neutral names and no private desktop content (e.g. a local dev server with test clients). Keep them around 1100 px wide.
