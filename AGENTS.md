# AGENTS.md: guide for coding agents

This project is a starter for small web apps that make decisions with **Jev** (TypeSafe's decision model) through **OpenRouter**.
The user usually does not program. They describe the app in a few sentences; you build it, check it and, when asked, deploy it to their VPS.
Talk to the user in their language, plainly and without jargon. Build the app's interface in the user's language unless they ask otherwise. Code identifiers and comments stay in English.

## What the user has to provide

1. **An OpenRouter key.** Created at https://openrouter.ai/settings/keys; the account needs credits (https://openrouter.ai/settings/credits).
   Recommend a credit limit on the key (e.g. 5 USD). Jev costs fractions of a cent, and the limit prevents surprises. Model: `jev-1.13`.
   - If there is no `.env`, run `cp .env.example .env` and ask the user to paste the key after `OPENROUTER_API_KEY=`.
   - If they paste the key into the chat, write it only to `.env`. Never print the key and never put it into code, docs, logs or commits (`.env` and `.env.*` are in `.gitignore`).
2. **What to build**, in plain words (4–5 sentences): who uses the app, what they paste or say, which decisions Jev should make and what to do with the result.
3. **For deployment (optional):** access to a VPS (e.g. Hostinger VPS KVM 2 through the Hostinger connector, or the server IP) and optionally a domain or subdomain.

If something is missing, ask at most 2–3 short questions at once. Do not ask about technical details you can decide yourself.

## Commands

| Command | What it does |
|---|---|
| `npm install` | installs dependencies (Node.js 22.12 or newer) |
| `npm run dev` | API on port 3000 and the page with Vite: http://localhost:5173 |
| `npm test` | tests (vitest, no network) |
| `npm run typecheck` | TypeScript type check |
| `npm run build` | builds the page (`dist/`) and the server (`dist-server/`) |
| `npm start` | production build on http://localhost:3000 (after `npm run build`) |

Settings in `.env` (template: `.env.example`): `OPENROUTER_API_KEY`, `JEV_MODEL`, `PORT`, `DAILY_BUDGET_USD`, `RATE_LIMIT_PER_MINUTE`, `BODY_LIMIT` (default `100kb`), `TZ` (time zone), and on the server also `APP_NAME`. Environment variables win over `.env`.

## How the starter works

```
browser --POST /api/recipes/<name> {data}--> Express --> recipe --> Jev (OpenRouter)
        <--- {result, ms, cost, costEstimated, calls} <--- recipe.interpret() / run()
```

The questions for Jev live on the server, in **recipes**. The browser only sends input data, so neither the key nor the questions leave the server.

| File | Role |
|---|---|
| `server/jev.ts` | Jev client: `createAskJev`, questions `choice()` / `score()` / `noul()`, readers `readChoice()` / `readScore()` / `readNoul()`, `askMany()`, `JevError`. Leave it as is. |
| `server/recipes/recipe.ts` | recipe contract, `defineRecipe()`, `RecipeContext` |
| `server/recipes/<name>.ts` | recipes: one decision = one recipe |
| `server/recipes/index.ts` | list of recipes served at `/api/recipes/<name>` |
| `server/context.ts` | the only way a recipe reaches Jev: every request checks the budget and records its cost |
| `server/routes.ts` | validation → recipe → `{result, ms, cost, costEstimated, calls}` |
| `server/app.ts` | Express: body size limit, per-IP rate limit, `/api/health`, `/api/stats`, serves `dist/` |
| `server/budget.ts` | daily Jev spending limit (402 once it is used up) |
| `server/config.ts` | settings from `.env` |
| `src/lib/api.ts` | `callRecipe(name, data)` → `{result, ms, cost, costEstimated, calls}`, errors ready to show |
| `src/components/CostBadge.tsx` | badge “Live · 312 ms · $0.000021” |
| `src/App.tsx`, `src/styles.css` | demo page, to be replaced |

API error codes (always with a readable message in `error`): 400 invalid input, 402 budget used up, 404 unknown recipe, 413 request too large, 429 rate limit, 500 server error, 502 Jev or OpenRouter error.
In production, Jev errors show a short, generic message to visitors. Details (status, OpenRouter's answer) go to the server log only; locally, under `npm run dev`, they are also in the message.

The daily spending counter lives in server memory: it resets at midnight in the `TZ` zone and on every restart or redeploy.

## How to build a new app

1. Write down the decisions: what goes in, what to ask Jev, what the app does with the answer. Counting, dates, comparisons and sums belong in code.
2. For each decision add a recipe `server/recipes/<name>.ts` (template below) and add it to the list in `server/recipes/index.ts`.
   **Never build a generic endpoint** that accepts questions or `state` from the browser. Anyone could then use the owner's key as a free Jev.
3. In the recipe's `zod` schema set maximum lengths and list sizes, with validation messages in the UI language.
4. On the page call `callRecipe<Input, Result>("<name>", data)` and show a `CostBadge` next to **every** result that comes from Jev (example below).
   `src/` and `server/` are separate TypeScript projects, so copy the result type to the page (like `DemoResult` in `src/App.tsx`).
5. Replace the demo page (`src/App.tsx`, `src/styles.css`). Readable interface with large type, plain CSS, no UI libraries.
   Once the app has its own recipes, remove `demo` from the list in `server/recipes/index.ts` and delete `server/recipes/demo.ts` and `test/demo.test.ts`.
6. Add tests in `test/`: `interpret()` on sample answers and input validation (template: `test/demo.test.ts`). Tests never touch the network; `test/routes.test.ts` has its own test recipes, so it keeps working.
7. Go through “Before you say it is done”.

Recipe template (one request: `build` + `interpret`):

```ts
// server/recipes/lead.ts
import { z } from "zod";
import { choice, noul, readChoice, readNoul } from "../jev.js";
import { defineRecipe } from "./recipe.js";

export interface LeadResult {
  service: "website" | "shop" | "other";
  sure: boolean;
  startsSoon: boolean;
}

export const lead = defineRecipe({
  name: "lead",
  input: z.object({
    text: z.string().trim().min(1, "Type the inquiry.").max(3000, "The inquiry can have at most 3000 characters."),
  }),
  build: ({ text }) => ({
    state: `Inquiry from a potential client:\n\n${text}`,
    questions: {
      service: choice("Which service does the sender ask about?", {
        website: "A company website or a landing page.",
        shop: "An online shop.",
        other: "Something else, or it is not clear.",
      }),
      startsSoon: noul("Does the sender want to start within a month?"),
    },
  }),
  interpret: (answers): LeadResult => {
    const service = readChoice(answers, "service");
    const startsSoon = readNoul(answers, "startsSoon");
    return {
      service: service.choice as LeadResult["service"],
      sure: service.confidence >= 0.7,
      startsSoon: startsSoon.noul >= 0.6,
    };
  },
});
```

```ts
// server/recipes/index.ts
export const recipes = registerRecipes([demo, lead]);
```

```tsx
// src/App.tsx
const response = await callRecipe<{ text: string }, LeadResult>("lead", { text });
// ...
<CostBadge ms={response.ms} cost={response.cost} calls={response.calls} estimated={response.costEstimated} />
```

`state` can be text or an object (sent as JSON). When the input has several fields, put them into an object.

## Many items at once

- **One request, each item in its own question.** Put the item's text into the `instructions` of its question. Questions are evaluated independently, so each item must be inside its own question; `state` is only the shared context (e.g. “Comments under a video about AI tools”). 20 questions in one request take about as long as one.
- **32k-token limit** for the whole request (state + all questions). Cap the list in the `zod` schema, e.g. `.max(30)` items and `.max(500)` characters per item.
- **Never send one request per item from the browser in a loop.** The per-IP rate limit will block it quickly. Send the whole list in one `callRecipe`.
- **More items than fit into one request:** a recipe with `run` and `ctx.askMany()`. It splits the work into batches, keeps at most 8 requests in flight, checks the budget before each one and sums the cost. Never reach Jev from a recipe other than through `ctx`.

Questions built from data (one request):

```ts
const KINDS = {
  question: "The commenter asks a question.",
  praise: "The commenter praises the video.",
  complaint: "The commenter criticises or complains.",
  other: "Anything else, including spam.",
};

export const comments = defineRecipe({
  name: "comments",
  input: z.object({
    comments: z.array(z.string().trim().min(1).max(500)).min(1).max(30, "At most 30 comments at once."),
  }),
  build: ({ comments }) => ({
    state: "Comments under a YouTube video about AI tools for small businesses.",
    questions: Object.fromEntries(
      comments.map((text, i) => [`c${i}`, choice(`What kind of comment is this? Comment: """${text}"""`, KINDS)]),
    ),
  }),
  interpret: (answers, { comments }) =>
    comments.map((text, i) => ({ text, kind: readChoice(answers, `c${i}`).choice })),
});
```

Several requests (`run` + `ctx.askMany`), e.g. up to 200 comments in batches of 25:

```ts
export const manyComments = defineRecipe({
  name: "many-comments",
  input: z.object({ comments: z.array(z.string().trim().min(1).max(500)).min(1).max(200) }),
  run: async ({ comments }, ctx) => {
    const chunks: string[][] = [];
    for (let i = 0; i < comments.length; i += 25) chunks.push(comments.slice(i, i + 25));
    const results = await ctx.askMany(
      chunks.map((chunk) => ({
        state: "Comments under a YouTube video about AI tools for small businesses.",
        questions: Object.fromEntries(chunk.map((text, i) => [`c${i}`, choice(`What kind of comment is this? Comment: """${text}"""`, KINDS)])),
      })),
    );
    return results.flatMap((result, c) =>
      chunks[c]!.map((text, i) => ({ text, kind: readChoice(result.answers, `c${i}`).choice })),
    );
  },
});
```

The response of such a recipe has `calls` (number of requests), `cost` (the sum) and `ms` (time from the first to the last request). `CostBadge` shows the number of requests when there is more than one.

## Jev cheat sheet

| Type | Use it for | `criteria` | Answer |
|---|---|---|---|
| `choice` | picking one option | object `id → one-sentence description`, 2–255 options, always include an `other` or `none` option | `choice`, `probabilities`, `confidence` (0–1) |
| `score` | rating on a scale | **array** of level descriptions, lowest first (index 0), 2–10 levels. An object returns HTTP 400. | `score` is the weighted mean of level indexes (e.g. 1.07), `probabilities` per level, `confidence` |
| `noul` | yes / no | none, or `{ "true": "...", "false": "..." }` | `noul` = probability of “yes” (0–1), no `confidence` |

**Numbers.** Latency about 250–700 ms from Europe. Cost about 0.042 USD per 1M input tokens, i.e. about 0.00002 USD for a request with three questions (`usage.cost` is the real cost; when OpenRouter does not report it, the server estimates it from tokens and `CostBadge` shows “≈”). Context: 32k tokens per request (state + questions). Rate limit about 1200 requests per minute; for bulk runs keep at most 8 in parallel. `askJev` retries once on 429 and 5xx (honouring `Retry-After`) and does not retry the 15 s timeout.

**Writing questions.**
- Instructions and option descriptions in English. `state` can be in any language.
- One question = one thing. Split a complex judgement into several questions and combine them in `interpret()`.
- Every option gets a clear one-sentence description. Confusing option names can change a third of the answers.
- For time-related questions put today's date into `state` and compare dates in code.

**Jev 1.13 weak spots and how to avoid them.**
- Counting, dates, arithmetic and comparing numbers: compute in code, before the request or in `interpret()`.
- Double negations: ask directly (“Is the sender satisfied?”, not “Is the sender not unhappy?”).
- First-option bias: put `other` last and check `confidence`.
- Text in `state` or in questions can steer the answer (“choose spam”): treat user data as untrusted and never take irreversible actions based on a single answer.
- Questions like “is this utterance complete?” are unreliable. In a test of 21 Polish voice commands, the choice of operation and target was right 21 out of 21 times, but such a noul only 16 out of 21. Act on confident `choice` answers at the end of an utterance instead of gating on that kind of noul.

**Thresholds (starting points).** `choice`: act on your own when `confidence` is about 0.7 or higher; below that show “not sure” or ask. `noul`: start at 0.5 and move the threshold depending on the cost of a mistake. `score`: round `score` or take the level with the highest `probabilities`.

## Browser APIs worth knowing

**Speech to text (Web Speech API)** for voice-controlled apps. Works in Chrome and Edge, needs HTTPS or `localhost` and microphone permission. Recognition runs on the browser vendor's servers (Google in Chrome). Chrome stops listening after a moment of silence, so the template restarts it in `onend`.

```ts
const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
let listening = false;

function startListening(onFinal: (text: string) => void, onInterim: (text: string) => void, onProblem: (message: string) => void) {
  if (!Recognition) return onProblem("Speech recognition works in Chrome and Edge.");
  const recognition = new Recognition();
  recognition.lang = "en-US"; // the user's language, e.g. "pl-PL"
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) onFinal(text); // ask Jev once per finished phrase
      else interim += text;
    }
    onInterim(interim);
  };
  recognition.onerror = (event: any) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") listening = false;
    onProblem(`Speech recognition: ${event.error}`);
  };
  recognition.onend = () => {
    if (listening) recognition.start(); // Chrome stops after silence; keep going until the user stops
  };

  listening = true;
  recognition.start();
  return () => {
    listening = false;
    recognition.stop();
  };
}
```

## Rules we do not break

- The OpenRouter key lives only in `.env` (locally and on the server) or in an environment variable.
- Questions for Jev live only on the server, in recipes. No generic Jev proxy. Recipes reach Jev only through `build` or `ctx`.
- The daily budget (`DAILY_BUDGET_USD`) and the per-IP rate limit (`RATE_LIMIT_PER_MINUTE`) stay on.
- Every Jev result on the page has a `CostBadge` next to it.
- No unnecessary dependencies. Before adding a library, check whether a few lines of code would do.

## Before you say it is done

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] One real Jev request: `npm run dev`, open http://localhost:5173 and go through the app's main flow (or `curl -X POST localhost:3000/api/recipes/<name> -H 'content-type: application/json' -d '{...}'`). The result makes sense, `CostBadge` shows time and cost, errors are readable.
- [ ] `git grep --untracked -nE "sk-or-v1-[a-f0-9]{20,}"` finds nothing (no real key in the repo or in new files).

Then tell the user in 2–3 sentences what works and how to run it.

## Deploying to a VPS (tested on Hostinger VPS KVM 2)

Goal: the user says “deploy this app to my VPS”, and you do the rest. The simplest path: Docker and one shared Caddy with HTTPS, no Coolify, no extra panels. It works on any Ubuntu or Debian VPS with root SSH access; it was tested on Hostinger VPS KVM 2 (2 vCPU, 8 GB RAM).

### Hard rules

- **Never stop, remove or reconfigure anything that already runs on the server**: containers, networks, volumes, nginx, Traefik, Caddy installed with apt, control panels, config files. You only change resources labelled `jev-starter=1`, the folder `/opt/apps/<APP>` and your own block in `/opt/caddy/Caddyfile`.
- When the server does not match the plan (another OS, ports 80/443 taken, a `caddy` container or `web` network that is not ours), **stop, tell the user what you found and ask** how to proceed.
- **DNS:** read the zone first. Only **add** a record for a new subdomain. Never touch `@`, `www`, MX or any existing record. If a tool has an overwrite mode, turn it off; overwrite only with the user's explicit consent.
- **Key:** copy the `.env` file; never print its contents.

**The Hostinger connector (MCP) is optional.** When it is connected, it has tools to: list VPS servers (name, plan, IP, state), manage SSH keys (add a public key and attach it to a VPS), manage the VPS firewall, and read and add DNS records for domains bought at Hostinger. Tool names differ between connector versions, so look for them by function. Without the connector ask the user for the server IP (Hostinger: hPanel → VPS → Overview; other providers: their control panel).

**Variables.** Start every command below by setting them (each shell call may start fresh):
`IP=203.0.113.10 APP=client-inbox HOST=client-inbox.203-0-113-10.sslip.io`
`APP`: lowercase letters, digits and dashes, unique on the server. `${APP:?}` aborts the command when the name is empty.

**0. First** go through “Before you say it is done” and make sure the local `.env` has the key.

**1. Server and IP.** With the connector, list the VPS servers and take the IPv4 address (if there are several, ask which one). Without it, ask for the IP.

**2. SSH access.**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@$IP 'echo ok'
```

If this fails:
- check for `~/.ssh/id_ed25519.pub`. If it does not exist, create a key: `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C jev-starter` (tell the user you are doing it),
- add the public key through the connector (SSH keys → add → attach to the VPS) or ask the user to paste the contents of the `.pub` file into the SSH keys section of their VPS panel,
- try again. Do not ask for the root password in the chat when a key can be used.

**3. Look at the server first (always, before changing anything).**

```bash
ssh root@$IP 'grep -E "^(PRETTY_NAME|ID|VERSION_ID)=" /etc/os-release'
ssh root@$IP "ss -ltnp '( sport = :80 or sport = :443 )'"
ssh root@$IP 'command -v docker >/dev/null && docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Label \"jev-starter\"}}" && docker network ls --format "{{.Name}}\t{{.Label \"jev-starter\"}}"'
ssh root@$IP 'ls /opt/apps 2>/dev/null; test -f /opt/caddy/Caddyfile && echo caddyfile-ok'
```

| What you see | What you do |
|---|---|
| an OS other than Ubuntu or Debian | stop and ask |
| ports 80/443 free, no `caddy` container and no `web` network | normal path: step 4 |
| ports 80/443 used by a `caddy` container labelled `jev-starter=1` | that is our Caddy; skip installing it |
| ports 80/443 used by anything else (Traefik from an n8n or Coolify template, nginx, Caddy from apt, a panel) | stop, change nothing, describe it and ask |
| a `caddy` container or `web` network without the `jev-starter=1` label | not ours: stop and ask |
| a container or `/opt/apps/` folder already named `APP` | pick another name (unless you are updating that same app) |

**4. Prepare the server (once per VPS).**

```bash
ssh root@$IP 'command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh'
ssh root@$IP 'docker network inspect web >/dev/null 2>&1 || docker network create --label jev-starter=1 web; mkdir -p /opt/caddy /opt/apps'
ssh root@$IP 'test -f /opt/caddy/Caddyfile' || rsync -az deploy/caddy/ "root@$IP:/opt/caddy/"
ssh root@$IP 'cd /opt/caddy && docker compose up -d'
```

Never overwrite an existing `/opt/caddy/Caddyfile`: it holds the blocks of other apps.

**5. Code, `.env` and the container.** Preview first (`--dry-run`), then copy for real:

```bash
rsync -az --delete --dry-run --itemize-changes --exclude node_modules --exclude dist --exclude dist-server --exclude .git --exclude .env --exclude '.env.*' --exclude .claude --exclude .codex ./ "root@$IP:/opt/apps/${APP:?}/"
rsync -az --delete --exclude node_modules --exclude dist --exclude dist-server --exclude .git --exclude .env --exclude '.env.*' --exclude .claude --exclude .codex ./ "root@$IP:/opt/apps/${APP:?}/"
ssh root@$IP "test -f /opt/apps/${APP:?}/.env" || scp .env "root@$IP:/opt/apps/${APP:?}/.env"
ssh root@$IP "cd /opt/apps/${APP:?} && sed -i '/^APP_NAME=/d' .env && printf '\nAPP_NAME=%s\n' '$APP' >> .env && chmod 600 .env && docker compose up -d --build && docker image prune -f --filter label=jev-starter=1"
```

The preview must list only project files inside `/opt/apps/APP/`. `docker image prune` with the label filter removes only old images of this starter.

Without `rsync` (e.g. Windows with Git Bash), pack the project into a file and send it with `scp`. Do not pipe the archive through PowerShell; it corrupts binary data:

```bash
tar --exclude=node_modules --exclude=dist --exclude=dist-server --exclude=.git --exclude=.env --exclude='.env.*' --exclude=.claude --exclude=.codex -czf ../app.tgz .
scp ../app.tgz "root@$IP:/tmp/${APP:?}.tgz"
ssh root@$IP "mkdir -p /opt/apps/${APP:?} && tar -xzf /tmp/${APP:?}.tgz -C /opt/apps/${APP:?} && rm /tmp/${APP:?}.tgz"
```

Then delete the local `../app.tgz`. This method does not remove files on the server that were deleted locally.

**6. An HTTPS address** (needed, among other things, for the microphone in browsers).
- A domain at Hostinger: through the connector read the DNS zone, make sure the subdomain does not exist yet and **add** only an A record, e.g. `app` → `IP` (TTL 300). Wait until `dig +short $HOST` returns the IP. For a domain at another provider, the user adds the record; give them its exact values.
- No domain: `HOST=APP.<IP with dashes instead of dots>.sslip.io`, e.g. `client-inbox.203-0-113-10.sslip.io`. Nothing to buy.

```bash
ssh root@$IP "grep -q 'reverse_proxy ${APP:?}:3000' /opt/caddy/Caddyfile || printf '\n%s {\n\timport security_headers\n\tencode\n\treverse_proxy %s:3000\n}\n' '$HOST' '$APP' >> /opt/caddy/Caddyfile"
ssh root@$IP 'cd /opt/caddy && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile'
```

If validation complains about a missing `security_headers`, add the `(security_headers)` block from `deploy/caddy/Caddyfile` at the top of `/opt/caddy/Caddyfile`. Caddy gets the HTTPS certificate on its own.

**7. Check and hand over.**

```bash
curl -fsS "https://$HOST/api/health"   # the first certificate can take up to a minute
```

Then send one real request to the main recipe (curl or the page). Give the user `https://HOST` and remind them:
- a credit limit on the OpenRouter key is a good idea,
- the app is public: anyone with the link can use it, but only up to the daily budget `DAILY_BUDGET_USD` and with the per-IP limit `RATE_LIMIT_PER_MINUTE`. Change them in `/opt/apps/APP/.env`, then run `docker compose up -d` in that folder.

**8. Updates.** Step 5 again (preview, `rsync`, `docker compose up -d --build`, `docker image prune`). The server's `.env` stays because it is excluded from copying. Caddy and DNS stay as they are. A redeploy resets the daily spending counter.

Several apps on one VPS: each has its own folder in `/opt/apps`, its own `APP` name and its own Caddyfile block. There is one Caddy. A KVM 2 handles several such apps easily.

**When something does not work.**
- App logs (this is where Jev error details are): `ssh root@$IP "cd /opt/apps/${APP:?} && docker compose logs --tail 100"`.
- Caddy logs: `ssh root@$IP 'docker logs caddy --tail 100'`. A certificate error usually means DNS does not point to the IP yet or the ports are closed.
- The page does not open: check the VPS firewall (connector or provider panel). TCP 80 and 443 must be open (and 22 for SSH). Never add `ports:` to the app's `docker-compose.yml`: Caddy is the only entry point from the internet.
- “container name already in use”: the `APP` name is taken. Pick another one and fix `APP_NAME` in `.env` and the Caddyfile block.
- Caddy answers 502: the app container is not running or has a different name (`ssh root@$IP 'docker ps'`).
