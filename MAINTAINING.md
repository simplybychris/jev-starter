# Utrzymanie projektu

Zasady dla opiekuna repozytorium. Widzowie i ich agenci tego nie potrzebują, dla nich są README.md i AGENTS.md.

## Commity

- [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `build`, `chore`, `test`, `refactor`, opcjonalny zakres, np. `feat(server): ...`.
- Krótko, po angielsku, granularnie: jeden działający moduł z zielonymi testami na commit.
- Bez linii `Co-Authored-By`.
- Pliki dodawaj z nazwy (`git add <ścieżki>`), nie `git add -A`. Nigdy nie commituj `.env`.

## CHANGELOG

Format [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje według [SemVer](https://semver.org/lang/pl/).
Nowe wpisy trafiają do `[Unreleased]`. Każdy blok zmian kończy się linią metadanych:

```
— <zadanie> · <RRRR-MM-DD> · impl: <model albo osoba> · review: <model albo osoba> · <pierwszy-hash>..<ostatni-hash>
```

Wydanie: przenieś `[Unreleased]` do `[X.Y.Z] - RRRR-MM-DD`, podbij `version` w `package.json`, otaguj `vX.Y.Z`.

## Przed wydaniem

1. `npm run typecheck`, `npm test`, `npm run build`.
2. `docker build -t jev-starter-test .`
3. Test na żywo: zbudowany serwer z prawdziwym kluczem w zmiennej środowiskowej (`OPENROUTER_API_KEY=... npm start` albo przez pęk kluczy), potem `curl -s -X POST localhost:3000/api/recipes/demo -H 'content-type: application/json' -d '{"text":"..."}'`. Klucz nie trafia do żadnego pliku.
4. `git grep -n "sk-or-"` nic nie znajduje.

## Zależności

- Sprawdzaj `npm outdated`. Vitest 5 i concurrently 10 wymagają Node.js 22, stąd `engines` `>=22.12` i obraz `node:22-alpine`.
- Nie dodawaj zależności, które da się zastąpić kilkoma linijkami kodu. Starter ma zostać mały i czytelny dla agentów.

## Co zmieniać ostrożnie

- Kontrakt przepisu (`server/recipes/recipe.ts`), API `server/jev.ts`, `callRecipe` i `CostBadge` są opisane w AGENTS.md. Każda zmiana tutaj wymaga aktualizacji AGENTS.md.
- Fakty o Jev w AGENTS.md (format API, limity, ceny, słabe strony) sprawdzono na żywo 02.10 i 10.10.2026. Przy nowej wersji modelu sprawdź je ponownie i zaktualizuj `JEV_MODEL` w `.env.example`.
- Procedura wdrożenia w AGENTS.md opisuje możliwości konektora Hostinger po funkcji, bez nazw narzędzi. Niech tak zostanie.
