# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-10

### Added

- Starter: Express 5 + TypeScript API and Vite + React page, one `npm run dev`, builds to `dist/` and `dist-server/`.
- Settings from `.env` and environment variables (the environment wins), with a clear error when the key is missing. `BODY_LIMIT` (default 100 kB) and `TZ` for the daily budget reset.
- Jev client (`server/jev.ts`): typed questions and answers (choice, score, noul), 15 s timeout, one retry on 429 and 5xx honouring `Retry-After`, cost estimated from tokens when OpenRouter does not report it, error messages that never leak the key.
- Recipes (`server/recipes/`): the questions stay on the server and the browser only sends input. Single-call recipes (`build` + `interpret`) and multi-call recipes (`run` with `ctx.ask()` / `ctx.askMany()`, at most 8 in parallel). Every call checks the budget and records its cost; the API returns `ms`, `cost`, `costEstimated` and `calls`.
- Daily budget (`DAILY_BUDGET_USD`, HTTP 402), per-IP rate limit that works behind a reverse proxy, `/api/health` and `/api/stats`.
- In production, visitors see short error messages; details go to the server log.
- Demo page with three result cards (Choice, Score, Noul) and `CostBadge` showing time and cost of every Jev call.
- Dockerfile, `docker-compose.yml` and a shared Caddy with security headers (`deploy/caddy/`). All deploy resources carry the `jev-starter=1` label.
- AGENTS.md: what the user provides, how to build apps with recipes, many items per request, Jev cheat sheet with weak spots, Web Speech API template, and a VPS deployment procedure (tested on Hostinger VPS KVM 2) with a server check first and strict rules never to touch running services or existing DNS records.
- README.md, README.pl.md (Polish quick start), CLAUDE.md, MAINTAINING.md, MIT license.

— Task 1 starter core · 2026-10-10 · impl: Claude Opus 5.5 · review: Claude Opus 5.5 · a635a4a..c2aeb50
— Task 1 review fixes · 2026-10-10 · impl: Claude Opus 5.5 · review: Claude Opus 5.5 · cfbfa30..d223f8d
— Task 1 English public version · 2026-10-10 · impl: Claude Opus 5.5 · review: Claude Opus 5.5 · 43c72c3..14381d2

[Unreleased]: https://github.com/simplybychris/jev-starter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/simplybychris/jev-starter/releases/tag/v0.1.0
