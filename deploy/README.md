# Wdrożenie na VPS (Hostinger KVM 2)

Najprościej: powiedz agentowi „wdróż tę aplikację na mój VPS w Hostingerze”. Pełna procedura dla agenta jest w [AGENTS.md](../AGENTS.md#wdrożenie-na-hostinger-vps-kvm-2). Poniżej to samo w skrócie, gdybyś chciał zrobić to ręcznie.

## Jak to jest poukładane na serwerze

```
/opt/caddy/                 wspólny Caddy (porty 80 i 443, certyfikaty HTTPS) – jeden na cały VPS
/opt/apps/<nazwa-aplikacji>/ każda aplikacja w osobnym folderze, z własnym .env i kontenerem
```

Caddy i aplikacje są w jednej sieci Dockera `web`. Aplikacje nie wystawiają portów na zewnątrz, ruch idzie tylko przez Caddy.

## Pierwszy raz na nowym VPS

```bash
curl -fsSL https://get.docker.com | sh          # jeśli nie ma Dockera
docker network create web                        # jeśli nie ma sieci web
mkdir -p /opt/caddy /opt/apps
# skopiuj zawartość deploy/caddy/ do /opt/caddy, potem:
cd /opt/caddy && docker compose up -d
```

## Nowa aplikacja

1. Skopiuj projekt do `/opt/apps/<nazwa>` (bez `node_modules`, `dist`, `dist-server`, `.git`).
2. Wgraj tam plik `.env` z kluczem i dopisz `APP_NAME=<nazwa>`.
3. `cd /opt/apps/<nazwa> && docker compose up -d --build`
4. Dopisz blok do `/opt/caddy/Caddyfile`:

   ```
   <nazwa>.<ip-z-myślnikami>.sslip.io {
   	encode
   	reverse_proxy <nazwa>:3000
   }
   ```

   Zamiast sslip.io możesz użyć własnej (sub)domeny z rekordem A wskazującym na IP serwera.
5. `cd /opt/caddy && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`
6. Sprawdź `https://<host>/api/health`.

## Aktualizacja

Skopiuj projekt jeszcze raz (plik `.env` na serwerze zostaje) i uruchom `docker compose up -d --build` w folderze aplikacji.

## Gdy coś nie działa

- Logi aplikacji: `cd /opt/apps/<nazwa> && docker compose logs --tail 100`
- Logi Caddy (certyfikaty, przekierowania): `docker logs caddy --tail 100`
- Strona się nie otwiera: sprawdź, czy porty 80 i 443 są otwarte w zaporze VPS w hPanelu.
