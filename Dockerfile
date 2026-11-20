FROM caddy:2.11.4-alpine
LABEL org.opencontainers.image.source=https://github.com/rusttalkcrew/website
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html roadmap.html impressum.html datenschutz.html legal.css lang.js favicon.svg /srv/
COPY img/ /srv/img/
EXPOSE 8080
