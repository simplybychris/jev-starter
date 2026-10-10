# Jev Starter

Gotowy szkielet małej aplikacji webowej, która podejmuje decyzje modelem **Jev** (TypeSafe) przez **OpenRouter**.
Opisujesz w kilku zdaniach, czego potrzebujesz, a Claude Code albo Codex budują to na tym starterze. Jednym poleceniem wdrażasz aplikację na swój VPS w Hostingerze.

Jev nie pisze tekstów. Odpowiada na pytania o tekst: wybiera opcję z listy, ocenia na skali albo podaje szansę na „tak”. Robi to w ok. pół sekundy i za ok. 0,00002 USD za zapytanie.

## Czego potrzebujesz

- [Node.js](https://nodejs.org) 22.12 lub nowszy,
- konto na [OpenRouter](https://openrouter.ai) z kredytami i kluczem API,
- Claude Code albo Codex,
- do wdrożenia: VPS w Hostingerze (plan KVM 2).

## Start w 3 krokach

**1. Klucz.** Utwórz klucz na https://openrouter.ai/settings/keys i ustaw na nim limit kredytów (np. 5 USD). Potem:

```bash
cp .env.example .env
```

Otwórz `.env` i wklej klucz po `OPENROUTER_API_KEY=`. Ten plik nie trafia do gita.

**2. Uruchomienie.**

```bash
npm install
npm run dev
```

Otwórz http://localhost:5173. Zobaczysz demo: Jev czyta wiadomość od klienta i w jednym zapytaniu mówi, czego dotyczy, jak jest pilna i czy nadawca jest zirytowany. Przy wyniku widać czas i koszt zapytania.

**3. Twoja aplikacja.** Otwórz folder w Claude Code albo Codex i opisz, co ma powstać, w 4–5 zdaniach. Na przykład:

> Zbuduj na tym starterze aplikację do sortowania zgłoszeń z formularza mojej szkoły językowej.
> Wklejam treść zgłoszenia, a Jev ocenia, jakiego kursu dotyczy (angielski, niemiecki, hiszpański, inny), czy chodzi o dziecko czy dorosłego i jak bardzo osoba jest zdecydowana na zapis.
> Wynik pokaż w trzech kartach, a pod nimi podpowiedź, co odpisać.
> Interfejs po polsku, prosty, z dużymi literami.

Agent wie, jak pracować z tym projektem, bo czyta [AGENTS.md](AGENTS.md).

## Wdrożenie

W tym samym oknie agenta napisz:

> Wdróż tę aplikację na mój VPS w Hostingerze.

Agent znajdzie serwer (przez konektor Hostinger albo zapyta o IP), skonfiguruje Dockera i Caddy, a na koniec poda adres z HTTPS. Jeśli masz domenę lub subdomenę, podaj ją. Bez domeny dostaniesz darmowy adres w sslip.io.
Szczegóły dla ciekawych: [deploy/README.md](deploy/README.md).

## Koszty i bezpieczeństwo

- Klucz zostaje na serwerze. Przeglądarka wysyła tylko dane, a pytania do Jev są zapisane w kodzie serwera.
- Dzienny limit wydatków (`DAILY_BUDGET_USD`, domyślnie 1 USD) i limit zapytań na adres IP (`RATE_LIMIT_PER_MINUTE`) ustawiasz w `.env`.
- Ustaw też limit kredytów na samym kluczu w OpenRouterze.

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm run dev` | uruchamia aplikację do pracy (strona na http://localhost:5173) |
| `npm test` | uruchamia testy |
| `npm run build` | buduje wersję produkcyjną |
| `npm start` | uruchamia wersję produkcyjną na http://localhost:3000 |

## Co jest w środku

- `server/`: Express i TypeScript, klient Jev, przepisy (pytania do Jev), budżet i limity,
- `src/`: strona w React (Vite),
- `test/`: testy,
- `Dockerfile`, `docker-compose.yml`, `deploy/`: wdrożenie na VPS.
