# Wdrożenie na VPS (np. Hostinger KVM 2)

Najprościej: powiedz agentowi „wdróż tę aplikację na mój VPS w Hostingerze”. Pełna procedura dla agenta jest w [AGENTS.md](../AGENTS.md#wdrożenie-na-vps-sprawdzone-na-hostinger-vps-kvm-2). Poniżej to samo w skrócie, gdybyś chciał zrobić to ręcznie na serwerze z Ubuntu albo Debianem.

## Jak to jest poukładane na serwerze

```
/opt/caddy/                  wspólny Caddy (porty 80 i 443, certyfikaty HTTPS) – jeden na cały VPS
/opt/apps/<nazwa-aplikacji>/ każda aplikacja w osobnym folderze, z własnym .env i kontenerem
```

Caddy i aplikacje są w jednej sieci Dockera `web`. Aplikacje nie wystawiają portów na zewnątrz, ruch idzie tylko przez Caddy.
Wszystko, co tworzy ten starter (kontenery, sieć, obrazy), ma etykietę `jev-starter=1`, więc łatwo odróżnić to od innych usług.

## Zanim zaczniesz

Sprawdź, co już działa na serwerze, i niczego z tego nie wyłączaj:

```bash
grep PRETTY_NAME /etc/os-release
ss -ltnp '( sport = :80 or sport = :443 )'
docker ps -a; docker network ls
```

Jeśli porty 80 i 443 zajmuje coś innego niż nasz Caddy (np. Traefik z szablonu n8n albo Coolify, nginx), ten sposób wdrożenia nie pasuje bez zmian. Zostaw działające usługi w spokoju i dopasuj konfigurację albo użyj osobnego serwera.

## Pierwszy raz na nowym VPS

```bash
curl -fsSL https://get.docker.com | sh                  # jeśli nie ma Dockera
docker network create --label jev-starter=1 web          # jeśli nie ma sieci web
mkdir -p /opt/caddy /opt/apps
# skopiuj zawartość deploy/caddy/ do /opt/caddy, potem:
cd /opt/caddy && docker compose up -d
```

## Nowa aplikacja

1. Skopiuj projekt do `/opt/apps/<nazwa>` (bez `node_modules`, `dist`, `dist-server`, `.git`, `.env*`, `.claude`, `.codex`).
2. Wgraj tam plik `.env` z kluczem i dopisz `APP_NAME=<nazwa>`.
3. `cd /opt/apps/<nazwa> && docker compose up -d --build && docker image prune -f --filter label=jev-starter=1`
4. Dopisz blok do `/opt/caddy/Caddyfile`:

   ```
   <nazwa>.<ip-z-myślnikami>.sslip.io {
   	import security_headers
   	encode
   	reverse_proxy <nazwa>:3000
   }
   ```

   Zamiast sslip.io możesz użyć własnej subdomeny z rekordem A wskazującym na IP serwera. Dodaj nowy rekord, nie zmieniaj istniejących.
5. `cd /opt/caddy && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`
6. Sprawdź `https://<host>/api/health`.

## Aktualizacja

Skopiuj projekt jeszcze raz (plik `.env` na serwerze zostaje) i uruchom `docker compose up -d --build` w folderze aplikacji. Wdrożenie zeruje dzienny licznik wydatków.

## Gdy coś nie działa

- Logi aplikacji (szczegóły błędów Jev): `cd /opt/apps/<nazwa> && docker compose logs --tail 100`
- Logi Caddy (certyfikaty, przekierowania): `docker logs caddy --tail 100`
- Strona się nie otwiera: sprawdź, czy porty 80 i 443 są otwarte w zaporze VPS.
