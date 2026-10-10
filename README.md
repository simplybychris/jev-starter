# Jev Starter

A ready-made skeleton for small web apps that make decisions with **Jev** through **OpenRouter**.
Describe what you need in a few sentences, let Claude Code or Codex build it on top of this starter, and deploy it to your own VPS with one more prompt.

Built for a video on the Detechtive YouTube channel (Polish): https://www.youtube.com/@detechtiveinfo
Po polsku: [README.pl.md](README.pl.md)

## What Jev is

Jev is TypeSafe's decision model. It does not write text; it answers questions about text: **Choice** picks one option from your list, **Score** rates on a scale you define, and **Noul** gives the probability of “yes”.
Answers come back in about half a second and cost about 0.00002 USD per request, so you can put a decision behind every click.

## Why OpenRouter

One account and one key for Jev (and any other model you may add later), pay-as-you-go credits, and a credit limit per key. The starter calls Jev as `jev-1.13` through OpenRouter, so there is nothing else to sign up for.

## Requirements

- [Node.js](https://nodejs.org) 22.12 or newer,
- an [OpenRouter](https://openrouter.ai) account with credits and an API key,
- Claude Code or Codex (any coding agent that reads `AGENTS.md` works),
- for deployment: a VPS with Ubuntu or Debian and root SSH access (tested on Hostinger VPS KVM 2).

## Quick start

**1. Key.** Create a key at https://openrouter.ai/settings/keys and set a credit limit on it (e.g. 5 USD). Then:

```bash
cp .env.example .env
```

Open `.env` and paste the key after `OPENROUTER_API_KEY=`. This file never goes into git.

**2. Run.**

```bash
npm install
npm run dev
```

Open http://localhost:5173. The demo reads a message from a client and, in one Jev request, tells you what it is about, how urgent it is and whether the sender is annoyed. Every result shows the time and cost of the request.

## Build your own app with an agent

Open the folder in Claude Code or Codex and describe the app in 4–5 sentences. For example:

> Build an app on this starter that sorts sign-up requests for my language school.
> I paste a request, and Jev decides which course it is about (English, German, Spanish, other), whether it is for a child or an adult, and how ready the person is to sign up.
> Show the result in three cards with a suggested reply below them.
> Simple interface with large type.

The agent knows how to work with this project because it reads [AGENTS.md](AGENTS.md): it adds a recipe (the questions for Jev) on the server, builds the page and runs the checks.

## Project structure

```
server/            Express + TypeScript API
  jev.ts           Jev client: typed questions and answers, retries, askMany
  recipes/         recipes = the questions for Jev, one decision each (demo.ts is the example)
  context.ts       budget-checked access to Jev for recipes
  routes.ts        POST /api/recipes/<name>
  app.ts           body limit, per-IP rate limit, /api/health, /api/stats, static files
  budget.ts        daily spending limit
src/               React page (Vite), CostBadge, callRecipe()
test/              vitest tests (no network)
deploy/            shared Caddy for the VPS + deploy notes
Dockerfile, docker-compose.yml
AGENTS.md          the guide for coding agents
```

## Safety

- The OpenRouter key stays on the server, in `.env`. The browser never sees it.
- The questions for Jev live on the server. The browser only sends input data, so nobody can use your key as a free Jev proxy.
- Set a credit limit on the key in OpenRouter.
- The app has a daily spending limit (`DAILY_BUDGET_USD`, default 1 USD) and a per-IP rate limit (`RATE_LIMIT_PER_MINUTE`).
- In production, visitors see short error messages; details stay in the server log.

## Deploy

In the same agent window write:

> Deploy this app to my VPS.

The agent finds the server (through the Hostinger connector, if you use Hostinger and have it connected, or by asking for the IP), checks what already runs there, sets up Docker and Caddy, and gives you an HTTPS address. It never stops or changes services that already run on the server. If you have a domain or subdomain, mention it: the agent only adds a new DNS record. Without a domain you get a free `sslip.io` address.
Manual steps and details: [deploy/README.md](deploy/README.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development mode (page at http://localhost:5173) |
| `npm test` | runs the tests |
| `npm run typecheck` | checks types |
| `npm run build` | builds the production version |
| `npm start` | runs the production version at http://localhost:3000 |

## License

[MIT](LICENSE)
