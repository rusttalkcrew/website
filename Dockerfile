FROM caddy:2.11.4-alpine
LABEL org.opencontainers.image.source=https://github.com/rusttalkcrew/website
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html roadmap.html impressum.html datenschutz.html legal.css lang.js favicon.svg sitemap.xml robots.txt /srv/
COPY de/ /srv/de/
COPY nl/ /srv/nl/
COPY ja/ /srv/ja/
COPY img/ /srv/img/
EXPOSE 8080
