# Maintaining

Rules for the repository maintainer. Users and their agents do not need this; they have README.md and AGENTS.md.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `build`, `chore`, `test`, `refactor`, with an optional scope, e.g. `feat(server): ...`.
- Short, in English, granular: one working module with green tests per commit.
- No `Co-Authored-By` lines.
- Stage files by name (`git add <paths>`), not `git add -A`. Never commit `.env`.

## CHANGELOG

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).
New entries go under `[Unreleased]`. Every block of changes ends with a metadata line:

```
— <task> · <YYYY-MM-DD> · impl: <model or person> · review: <model or person> · <first-hash>..<last-hash>
```

Release: move `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, bump `version` in `package.json`, commit `chore(release): vX.Y.Z` and tag `vX.Y.Z`.

## Before a release

1. `npm run typecheck`, `npm test`, `npm run build`.
2. `docker build -t jev-starter-test .`
3. Live test: the built server with a real key in an environment variable (`OPENROUTER_API_KEY=... npm start`), then `curl -s -X POST localhost:3000/api/recipes/demo -H 'content-type: application/json' -d '{"text":"..."}'`. The key never goes into a file.
4. `git grep --untracked -nE "sk-or-v1-[a-f0-9]{20,}"` finds nothing.

## Dependencies

- Check `npm outdated`. Vitest 5 and concurrently 10 need Node.js 22, hence `engines` `>=22.12` and the `node:22-alpine` image.
- Do not add dependencies that a few lines of code can replace. The starter should stay small and easy for agents to read.

## Change with care

- The recipe contract (`server/recipes/recipe.ts`), the `server/jev.ts` API, `callRecipe` and `CostBadge` are described in AGENTS.md. Any change here needs an AGENTS.md update.
- The Jev facts in AGENTS.md (API format, limits, prices, weak spots) were verified live on 2026-10-02 and 2026-10-10. With a new model version, verify them again and update `JEV_MODEL` in `.env.example`.
- The deploy procedure in AGENTS.md describes the Hostinger connector by function, not by tool names. Keep it that way.
