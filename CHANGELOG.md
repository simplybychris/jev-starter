# Changelog

Wszystkie istotne zmiany w projekcie. Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje według [SemVer](https://semver.org/lang/pl/).

## [Unreleased]

### Added

- Szkielet: Express 5 i TypeScript (API) oraz Vite i React (strona), jedno `npm run dev`, build do `dist/` i `dist-server/`.
- Ustawienia z `.env` i zmiennych środowiskowych (środowisko wygrywa), czytelny błąd po polsku przy braku klucza.
- Klient Jev (`server/jev.ts`): typowane pytania i odpowiedzi (choice, score, noul), limit czasu 15 s, jedno ponowienie przy 429 i 5xx, polskie komunikaty błędów bez wycieku klucza.
- Przepisy (`server/recipes/`): pytania zostają na serwerze, przeglądarka wysyła tylko dane. Przepis `demo` (temat, pilność, irytacja nadawcy).
- Dzienny budżet (`DAILY_BUDGET_USD`, kod 402), limit zapytań na IP, limit 20 kB na zapytanie, `/api/health` i `/api/stats`.
- Strona demo z trzema kartami wyników i `CostBadge` (czas i koszt każdego zapytania do Jev).
- Dockerfile, `docker-compose.yml` i wspólny Caddy (`deploy/caddy/`) do wdrożenia na Hostinger VPS KVM 2.
- AGENTS.md (przewodnik dla agenta ze ściągą Jev i procedurą wdrożenia), CLAUDE.md, README.md, MAINTAINING.md.

— Task 1 starter core · 2026-10-10 · impl: Claude Opus 5.5 · review: pending · a635a4a..c2aeb50
