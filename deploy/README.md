# Deploying to a VPS

The easy way: tell your coding agent “deploy this app to my VPS”. The full procedure for agents is in [AGENTS.md](../AGENTS.md#deploying-to-a-vps-tested-on-hostinger-vps-kvm-2).
Below is the same in short, if you want to do it by hand. It works on any VPS with Ubuntu or Debian and root SSH access; it was tested on Hostinger VPS KVM 2.

## Layout on the server

```
/opt/caddy/             shared Caddy (ports 80 and 443, HTTPS certificates), one per VPS
/opt/apps/<app-name>/   each app in its own folder, with its own .env and container
```

Caddy and the apps share the Docker network `web`. Apps publish no ports; all traffic goes through Caddy.
Everything this starter creates (containers, network, images) carries the label `jev-starter=1`, so it is easy to tell apart from other services.

## Before you start

Check what already runs on the server, and leave all of it alone:

```bash
grep PRETTY_NAME /etc/os-release
ss -ltnp '( sport = :80 or sport = :443 )'
docker ps -a; docker network ls
```

If ports 80 and 443 are taken by something other than our Caddy (e.g. Traefik from an n8n or Coolify template, or nginx), this setup does not fit as is. Keep the running services untouched and adapt the configuration, or use a separate server.

## First time on a new VPS

```bash
curl -fsSL https://get.docker.com | sh                  # if Docker is missing
docker network create --label jev-starter=1 web          # if the web network is missing
mkdir -p /opt/caddy /opt/apps
# copy the contents of deploy/caddy/ to /opt/caddy, then:
cd /opt/caddy && docker compose up -d
```

## A new app

1. Copy the project to `/opt/apps/<app-name>` (without `node_modules`, `dist`, `dist-server`, `.git`, `.env*`, `.claude`, `.codex`).
2. Upload your `.env` with the key there and add `APP_NAME=<app-name>`.
3. `cd /opt/apps/<app-name> && docker compose up -d --build && docker image prune -f --filter label=jev-starter=1`
4. Add a block to `/opt/caddy/Caddyfile`:

   ```
   <app-name>.<ip-with-dashes>.sslip.io {
   	import security_headers
   	encode
   	reverse_proxy <app-name>:3000
   }
   ```

   Instead of sslip.io you can use your own subdomain with an A record pointing to the server IP. Add a new record; do not change existing ones.
5. `cd /opt/caddy && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`
6. Open `https://<host>/api/health`.

## Updates

Copy the project again (the server's `.env` stays) and run `docker compose up -d --build` in the app folder. A redeploy resets the daily spending counter.

## Troubleshooting

- App logs (Jev error details): `cd /opt/apps/<app-name> && docker compose logs --tail 100`
- Caddy logs (certificates, routing): `docker logs caddy --tail 100`
- The page does not open: make sure ports 80 and 443 are open in the VPS firewall.
