# AGENTS.md: przewodnik dla agenta

Ten projekt to starter do małych aplikacji webowych, które podejmują decyzje modelem **Jev** (TypeSafe) przez **OpenRouter**.
Użytkownik zwykle nie programuje. Opisuje aplikację w kilku zdaniach, a Ty ją budujesz, sprawdzasz i na prośbę wdrażasz na jego VPS.
Pisz do niego po polsku, prosto i bez żargonu. Interfejs aplikacji też po polsku. Nazwy w kodzie i komentarze po angielsku.

## Co musi podać użytkownik

1. **Klucz OpenRouter.** Tworzy się go na https://openrouter.ai/settings/keys, a konto musi mieć kredyty (https://openrouter.ai/settings/credits).
   Poleć ustawienie limitu kredytów na kluczu (np. 5 USD). Jev kosztuje grosze, a limit chroni przed niespodzianką. Model: `jev-1.13`.
   - Jeśli nie ma pliku `.env`, zrób `cp .env.example .env` i poproś, żeby użytkownik wkleił klucz po `OPENROUTER_API_KEY=`.
   - Jeśli wklei klucz w czacie, zapisz go tylko w `.env`. Nigdy nie wypisuj klucza, nie wpisuj go do kodu, dokumentacji, logów ani commitów (`.env` i `.env.*` są w `.gitignore`).
2. **Co zbudować**, zwykłymi słowami (4–5 zdań): kto będzie używał aplikacji, co do niej wkleja albo mówi, jakie decyzje ma podjąć Jev i co zrobić z wynikiem.
3. **Do wdrożenia (opcjonalnie):** dostęp do VPS (np. Hostinger KVM 2 przez konektor Hostinger albo IP serwera) i ewentualnie domena lub subdomena.

Gdy czegoś brakuje, zadaj najwyżej 2–3 krótkie pytania naraz. O sprawy techniczne nie pytaj, rozstrzygaj je sam.

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm install` | instaluje zależności (Node.js 22.12 lub nowszy) |
| `npm run dev` | API na porcie 3000 i strona z Vite: http://localhost:5173 |
| `npm test` | testy (vitest, bez sieci) |
| `npm run typecheck` | sprawdza typy TypeScriptu |
| `npm run build` | buduje stronę (`dist/`) i serwer (`dist-server/`) |
| `npm start` | wersja produkcyjna na http://localhost:3000 (po `npm run build`) |

Ustawienia w `.env` (wzór w `.env.example`): `OPENROUTER_API_KEY`, `JEV_MODEL`, `PORT`, `DAILY_BUDGET_USD`, `RATE_LIMIT_PER_MINUTE`, `BODY_LIMIT` (domyślnie `100kb`), `TZ` (strefa czasowa), na serwerze także `APP_NAME`. Zmienne środowiskowe mają pierwszeństwo przed `.env`.

## Jak działa starter

```
przeglądarka --POST /api/recipes/<nazwa> {dane}--> Express --> przepis --> Jev (OpenRouter)
             <--- {result, ms, cost, costEstimated, calls} <--- przepis.interpret() / run()
```

Pytania do Jev siedzą na serwerze w **przepisach** (recipes). Przeglądarka wysyła tylko dane wejściowe, więc klucz i pytania nie wychodzą poza serwer.

| Plik | Rola |
|---|---|
| `server/jev.ts` | klient Jev: `createAskJev`, pytania `choice()` / `score()` / `noul()`, odczyt `readChoice()` / `readScore()` / `readNoul()`, `askMany()`, `JevError`. Zostaw bez zmian. |
| `server/recipes/recipe.ts` | kontrakt przepisu, `defineRecipe()`, `RecipeContext` |
| `server/recipes/<nazwa>.ts` | przepisy: jedna decyzja = jeden przepis |
| `server/recipes/index.ts` | lista przepisów dostępnych pod `/api/recipes/<nazwa>` |
| `server/context.ts` | jedyna droga przepisu do Jev: każde zapytanie sprawdza budżet i zapisuje koszt |
| `server/routes.ts` | walidacja → przepis → `{result, ms, cost, costEstimated, calls}` |
| `server/app.ts` | Express: limit rozmiaru zapytania, limit zapytań na IP, `/api/health`, `/api/stats`, serwowanie `dist/` |
| `server/budget.ts` | dzienny limit wydatków na Jev (po przekroczeniu kod 402) |
| `server/config.ts` | ustawienia z `.env` |
| `src/lib/api.ts` | `callRecipe(nazwa, dane)` → `{result, ms, cost, costEstimated, calls}`, błędy gotowe do pokazania |
| `src/components/CostBadge.tsx` | plakietka „Na żywo · 312 ms · 0,000021 $” |
| `src/App.tsx`, `src/styles.css` | strona demo, do podmiany |

Kody błędów API (zawsze z polskim komunikatem w polu `error`): 400 złe dane, 402 wyczerpany budżet, 404 nie ma przepisu, 413 za duże zapytanie, 429 limit zapytań, 500 błąd serwera, 502 błąd Jev albo OpenRoutera.
Na produkcji błędy Jev mają krótki, ogólny komunikat dla odwiedzających. Szczegóły (status, odpowiedź OpenRoutera) są tylko w logach serwera, a lokalnie w `npm run dev` także w komunikacie.

Dzienny licznik wydatków jest w pamięci serwera: zeruje się o północy w strefie `TZ` oraz przy każdym restarcie i wdrożeniu.

## Jak zbudować nową aplikację

1. Rozpisz decyzje: co wchodzi, o co zapytać Jev, co aplikacja robi z odpowiedzią. Liczenie, daty, porównania i sumy zostaw kodowi.
2. Dla każdej decyzji dodaj przepis `server/recipes/<nazwa>.ts` (wzór niżej) i dopisz go do listy w `server/recipes/index.ts`.
   **Nigdy nie rób ogólnego endpointu**, który przyjmuje pytania albo `state` z przeglądarki. Każdy mógłby wtedy używać klucza właściciela jako darmowego Jev.
3. W schemacie `zod` przepisu ustaw maksymalne długości pól i rozmiary list oraz komunikaty walidacji po polsku.
4. Na stronie wołaj `callRecipe<Wejście, Wynik>("<nazwa>", dane)` i przy **każdym** wyniku z Jev pokaż `CostBadge` (wzór niżej).
   `src/` i `server/` to osobne projekty TypeScriptu, więc typ wyniku skopiuj na stronę (jak `DemoResult` w `src/App.tsx`).
5. Zastąp stronę demo (`src/App.tsx`, `src/styles.css`). Interfejs po polsku, czytelny, z dużymi literami, zwykły CSS bez bibliotek UI.
   Gdy aplikacja ma już własne przepisy, usuń `demo` z listy w `server/recipes/index.ts` oraz pliki `server/recipes/demo.ts` i `test/demo.test.ts`.
6. Dopisz testy w `test/`: `interpret()` na przykładowych odpowiedziach i walidację wejścia (wzór: `test/demo.test.ts`). Testy nie łączą się z siecią, a `test/routes.test.ts` ma własne przepisy testowe, więc działa bez zmian.
7. Przejdź listę „Zanim powiesz, że gotowe”.

Wzór przepisu (jedno zapytanie: `build` + `interpret`):

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
    text: z.string().trim().min(1, "Wpisz treść zapytania.").max(3000, "Zapytanie może mieć najwyżej 3000 znaków."),
  }),
  build: ({ text }) => ({
    state: `Inquiry from a potential client (it may be written in Polish):\n\n${text}`,
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

`state` może być tekstem albo obiektem (wyśle się jako JSON). Gdy danych jest kilka pól, złóż z nich obiekt.

## Wiele elementów naraz

- **Jedno zapytanie, każdy element we własnym pytaniu.** Tekst elementu wpisz do `instructions` jego pytania. Pytania są oceniane niezależnie od siebie, więc element musi być w swoim pytaniu, a `state` to tylko wspólny kontekst (np. „Comments under a video about AI tools”). 20 pytań w jednym zapytaniu trwa prawie tyle co jedno.
- **Limit 32 tys. tokenów** na całe zapytanie (stan + wszystkie pytania). Ogranicz listę w schemacie `zod`, np. `.max(30)` elementów i `.max(500)` znaków na element.
- **Nigdy nie wysyłaj z przeglądarki osobnego zapytania na każdy element w pętli.** Limit zapytań na IP szybko to zablokuje. Wysyłaj całą listę jednym `callRecipe`.
- **Więcej elementów, niż mieści jedno zapytanie:** przepis z `run` i `ctx.askMany()`. Dzieli pracę na paczki, wysyła najwyżej 8 zapytań naraz, sprawdza budżet przed każdym i sumuje koszt. Nie wołaj Jev w przepisie inaczej niż przez `ctx`.

Pytania budowane z danych (jedno zapytanie):

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
    comments: z.array(z.string().trim().min(1).max(500)).min(1).max(30, "Najwyżej 30 komentarzy naraz."),
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

Kilka zapytań (`run` + `ctx.askMany`), np. do 200 komentarzy w paczkach po 25:

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

Odpowiedź takiego przepisu ma `calls` (liczbę zapytań), `cost` (sumę) i `ms` (czas od pierwszego do ostatniego zapytania). `CostBadge` pokazuje liczbę zapytań, gdy jest ich więcej niż jedno.

## Ściąga Jev

| Typ | Do czego | `criteria` | Odpowiedź |
|---|---|---|---|
| `choice` | wybór jednej opcji | obiekt `id → jednozdaniowy opis`, 2–255 opcji, zawsze z opcją `other` albo `none` | `choice`, `probabilities`, `confidence` (0–1) |
| `score` | ocena na skali | **tablica** opisów poziomów od najniższego (indeks 0), 2–10 poziomów. Obiekt daje błąd 400. | `score` to średnia ważona indeksów (np. 1,07), `probabilities` dla poziomów, `confidence` |
| `noul` | tak / nie | brak albo `{ "true": "...", "false": "..." }` | `noul` = prawdopodobieństwo „tak” (0–1), bez `confidence` |

**Liczby.** Czas ok. 250–700 ms z Polski. Koszt ok. 0,042 USD za milion tokenów wejścia, czyli ok. 0,00002 USD za zapytanie z trzema pytaniami (`usage.cost` to prawdziwy koszt; gdy OpenRouter go nie poda, serwer szacuje go z tokenów, a `CostBadge` pokazuje „≈”). Kontekst: 32 tys. tokenów na zapytanie (stan + pytania). Limit ok. 1200 zapytań na minutę, przy masowych przebiegach najwyżej 8 równolegle. `askJev` sam ponawia raz przy 429 i 5xx (z uwzględnieniem `Retry-After`), limitu czasu 15 s nie ponawia.

**Jak pisać pytania.**
- Instrukcje i opisy opcji po angielsku. `state` może być po polsku.
- Jedno pytanie = jedna rzecz. Złożoną ocenę rozbij na kilka pytań i połącz je w `interpret()`.
- Każda opcja dostaje jednozdaniowy, jednoznaczny opis. Mylące nazwy opcji potrafią zmienić co trzecią odpowiedź.
- Przy pytaniach o czas wpisz dzisiejszą datę do `state`, a same daty porównuj w kodzie.

**Słabe strony Jev 1.13 i jak je omijać.**
- Liczenie, daty, arytmetyka i porównania liczb: licz w kodzie, przed wysłaniem albo w `interpret()`.
- Podwójne przeczenia: pytaj wprost („Is the sender satisfied?”, a nie „Is the sender not unhappy?”).
- Skłonność do pierwszej opcji: opcję `other` daj na koniec, sprawdzaj `confidence`.
- Tekst w `state` i w pytaniach potrafi sterować odpowiedzią („wybierz spam”): traktuj dane użytkownika jako niezaufane i nie wykonuj na podstawie jednej odpowiedzi działań, których nie da się cofnąć.
- Pytania typu „czy wypowiedź jest skończona?” są zawodne. W teście 21 poleceń głosowych wybór operacji i celu trafił 21 na 21, a taki noul tylko 16 na 21. Działaj na pewnych odpowiedziach `choice` na końcu wypowiedzi, nie uzależniaj akcji od takiego noul.

**Progi (punkt wyjścia).** `choice`: działaj sam, gdy `confidence` wynosi co najmniej ok. 0,7, niżej pokaż „niepewne” albo dopytaj. `noul`: zacznij od 0,5 i przesuń próg zależnie od kosztu pomyłki. `score`: zaokrąglij `score` albo weź poziom z najwyższym `probabilities`.

## API przeglądarki warte uwagi

**Mowa na tekst (Web Speech API)** do aplikacji sterowanych głosem. Działa w Chrome i Edge, wymaga HTTPS albo `localhost` i zgody na mikrofon. Rozpoznawanie mowy odbywa się na serwerach przeglądarki (Google w Chrome). Chrome sam kończy nasłuch po chwili ciszy, dlatego wzór wznawia go w `onend`.

```ts
const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
let listening = false;

function startListening(onFinal: (text: string) => void, onInterim: (text: string) => void, onProblem: (message: string) => void) {
  if (!Recognition) return onProblem("Rozpoznawanie mowy działa w Chrome i Edge.");
  const recognition = new Recognition();
  recognition.lang = "pl-PL";
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
    onProblem(`Rozpoznawanie mowy: ${event.error}`);
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

## Zasady, których nie łamiemy

- Klucz OpenRouter tylko w `.env` (lokalnie i na serwerze) albo w zmiennej środowiskowej.
- Pytania do Jev tylko na serwerze, w przepisach. Żadnego ogólnego pośrednika do Jev. Przepisy wołają Jev tylko przez `ctx` albo `build`.
- Dzienny budżet (`DAILY_BUDGET_USD`) i limit zapytań na IP (`RATE_LIMIT_PER_MINUTE`) zostają włączone.
- Każdy wynik z Jev na stronie ma obok `CostBadge`.
- Bez zbędnych zależności. Zanim dodasz bibliotekę, sprawdź, czy nie wystarczy kilka linijek kodu.

## Zanim powiesz, że gotowe

- [ ] `npm run typecheck` przechodzi.
- [ ] `npm test` przechodzi.
- [ ] `npm run build` przechodzi.
- [ ] Jedno prawdziwe zapytanie do Jev: `npm run dev`, otwórz http://localhost:5173 i przejdź główną ścieżkę aplikacji (albo `curl -X POST localhost:3000/api/recipes/<nazwa> -H 'content-type: application/json' -d '{...}'`). Wynik ma sens, `CostBadge` pokazuje czas i koszt, błędy są po polsku.
- [ ] `git grep --untracked -nE "sk-or-v1-[a-f0-9]{20,}"` nic nie znajduje (w repo i nowych plikach nie ma prawdziwego klucza).

Potem w 2–3 zdaniach powiedz użytkownikowi, co działa i jak to uruchomić.

## Wdrożenie na VPS (sprawdzone na Hostinger VPS KVM 2)

Cel: użytkownik mówi „wdróż tę aplikację na mój VPS w Hostingerze”, a Ty robisz resztę. Najprostsza droga: Docker i jeden wspólny Caddy z HTTPS, bez Coolify i dodatkowych paneli. Działa na każdym VPS z Ubuntu albo Debianem.

### Twarde zasady

- **Nigdy nie zatrzymuj, nie usuwaj i nie przestawiaj tego, co już działa na serwerze**: kontenerów, sieci, wolumenów, nginx, Traefika, Caddy z apt, paneli, plików konfiguracyjnych. Zmieniasz tylko zasoby z etykietą `jev-starter=1`, folder `/opt/apps/<NAZWA>` i własny blok w `/opt/caddy/Caddyfile`.
- Gdy serwer nie pasuje do planu (inny system, zajęte porty 80/443, cudzy kontener `caddy` albo sieć `web`), **zatrzymaj się, opisz użytkownikowi, co widzisz, i zapytaj**, co dalej.
- **DNS:** najpierw odczytaj strefę. Tylko **dodawaj** rekord dla nowej subdomeny. Nigdy nie zmieniaj `@`, `www`, MX ani istniejących rekordów. Jeśli narzędzie ma tryb nadpisywania (overwrite), wyłącz go; nadpisanie tylko po wyraźnej zgodzie użytkownika.
- **Klucz:** kopiujesz plik `.env`, nigdy nie wypisujesz jego treści.

**Konektor Hostinger (MCP)** jest opcjonalny. Jeśli jest podłączony, ma narzędzia do: listy serwerów VPS (nazwa, plan, IP, stan), kluczy SSH (dodanie klucza publicznego i podpięcie go do VPS), zapory VPS i strefy DNS domen kupionych w Hostingerze (odczyt rekordów, dodanie rekordu). Nazwy narzędzi różnią się między wersjami konektora, więc szukaj ich po funkcji. Bez konektora poproś użytkownika o IP serwera (w hPanelu: VPS → Przegląd).

**Zmienne.** Każde polecenie poniżej zaczynaj od ich ustawienia (kolejne wywołania powłoki mogą nie pamiętać zmiennych):
`IP=203.0.113.10 NAZWA=skrzynka-klientow HOST=skrzynka-klientow.203-0-113-10.sslip.io`
`NAZWA`: małe litery, cyfry i myślniki, unikalna na serwerze. Zapis `${NAZWA:?}` przerywa polecenie, gdy nazwa jest pusta.

**0. Najpierw** przejdź listę „Zanim powiesz, że gotowe” i upewnij się, że lokalny `.env` ma klucz.

**1. Serwer i IP.** Przez konektor pobierz listę VPS i weź IPv4 (gdy serwerów jest kilka, zapytaj który). Bez konektora zapytaj o IP.

**2. Dostęp SSH.**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@$IP 'echo ok'
```

Jeśli to nie działa:
- sprawdź, czy jest `~/.ssh/id_ed25519.pub`. Gdy go nie ma, utwórz klucz: `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C jev-starter` (powiedz użytkownikowi, że to robisz),
- dodaj klucz publiczny przez konektor (klucze SSH → dodaj → podepnij do VPS) albo poproś użytkownika, żeby wkleił zawartość pliku `.pub` w panelu VPS, w sekcji kluczy SSH,
- powtórz test. Nie proś o hasło roota w czacie, skoro można użyć klucza.

**3. Rozpoznanie serwera (zawsze, zanim cokolwiek zmienisz).**

```bash
ssh root@$IP 'grep -E "^(PRETTY_NAME|ID|VERSION_ID)=" /etc/os-release'
ssh root@$IP "ss -ltnp '( sport = :80 or sport = :443 )'"
ssh root@$IP 'command -v docker >/dev/null && docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Label \"jev-starter\"}}" && docker network ls --format "{{.Name}}\t{{.Label \"jev-starter\"}}"'
ssh root@$IP 'ls /opt/apps 2>/dev/null; test -f /opt/caddy/Caddyfile && echo caddyfile-ok'
```

| Co widzisz | Co robisz |
|---|---|
| system inny niż Ubuntu albo Debian | zatrzymaj się i zapytaj |
| porty 80/443 wolne, nie ma kontenera `caddy` ani sieci `web` | normalna ścieżka: krok 4 |
| porty 80/443 zajmuje kontener `caddy` z etykietą `jev-starter=1` | to nasz Caddy, pomiń jego instalację |
| porty 80/443 zajmuje coś innego (Traefik z szablonu n8n albo Coolify, nginx, Caddy z apt, panel) | zatrzymaj się, niczego nie zmieniaj, opisz to i zapytaj |
| jest kontener `caddy` albo sieć `web` bez etykiety `jev-starter=1` | to nie nasze: zatrzymaj się i zapytaj |
| jest już kontener albo folder `/opt/apps/` o nazwie `NAZWA` | wybierz inną nazwę (chyba że to aktualizacja tej samej aplikacji) |

**4. Przygotowanie serwera (raz na VPS).**

```bash
ssh root@$IP 'command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh'
ssh root@$IP 'docker network inspect web >/dev/null 2>&1 || docker network create --label jev-starter=1 web; mkdir -p /opt/caddy /opt/apps'
ssh root@$IP 'test -f /opt/caddy/Caddyfile' || rsync -az deploy/caddy/ "root@$IP:/opt/caddy/"
ssh root@$IP 'cd /opt/caddy && docker compose up -d'
```

Nie nadpisuj istniejącego `/opt/caddy/Caddyfile`: są w nim bloki innych aplikacji.

**5. Kod, `.env` i kontener.** Najpierw podgląd (`--dry-run`), potem właściwe kopiowanie:

```bash
rsync -az --delete --dry-run --itemize-changes --exclude node_modules --exclude dist --exclude dist-server --exclude .git --exclude .env --exclude '.env.*' --exclude .claude --exclude .codex ./ "root@$IP:/opt/apps/${NAZWA:?}/"
rsync -az --delete --exclude node_modules --exclude dist --exclude dist-server --exclude .git --exclude .env --exclude '.env.*' --exclude .claude --exclude .codex ./ "root@$IP:/opt/apps/${NAZWA:?}/"
ssh root@$IP "test -f /opt/apps/${NAZWA:?}/.env" || scp .env "root@$IP:/opt/apps/${NAZWA:?}/.env"
ssh root@$IP "cd /opt/apps/${NAZWA:?} && sed -i '/^APP_NAME=/d' .env && printf '\nAPP_NAME=%s\n' '$NAZWA' >> .env && chmod 600 .env && docker compose up -d --build && docker image prune -f --filter label=jev-starter=1"
```

W podglądzie mają być tylko pliki projektu w `/opt/apps/NAZWA/`. `docker image prune` z filtrem usuwa wyłącznie stare obrazy tego startera.

Bez `rsync` (np. Windows z Git Bash) spakuj projekt do pliku i wyślij go przez `scp`. Nie przepuszczaj archiwum przez potok w PowerShellu, bo psuje dane binarne:

```bash
tar --exclude=node_modules --exclude=dist --exclude=dist-server --exclude=.git --exclude=.env --exclude='.env.*' --exclude=.claude --exclude=.codex -czf ../app.tgz .
scp ../app.tgz "root@$IP:/tmp/${NAZWA:?}.tgz"
ssh root@$IP "mkdir -p /opt/apps/${NAZWA:?} && tar -xzf /tmp/${NAZWA:?}.tgz -C /opt/apps/${NAZWA:?} && rm /tmp/${NAZWA:?}.tgz"
```

Potem usuń lokalny `../app.tgz`. Ta metoda nie kasuje na serwerze plików usuniętych lokalnie.

**6. Adres z HTTPS** (potrzebny m.in. do mikrofonu w przeglądarce).
- Domena w Hostingerze: przez konektor odczytaj strefę DNS, upewnij się, że subdomeny jeszcze nie ma, i **dodaj** tylko rekord A, np. `app` → `IP` (TTL 300). Poczekaj, aż `dig +short $HOST` zwróci IP. Domenę u innego dostawcy użytkownik ustawia sam, podaj mu rekord.
- Bez domeny: `HOST=NAZWA.<IP z myślnikami zamiast kropek>.sslip.io`, np. `skrzynka-klientow.203-0-113-10.sslip.io`. Nic nie trzeba kupować.

```bash
ssh root@$IP "grep -q 'reverse_proxy ${NAZWA:?}:3000' /opt/caddy/Caddyfile || printf '\n%s {\n\timport security_headers\n\tencode\n\treverse_proxy %s:3000\n}\n' '$HOST' '$NAZWA' >> /opt/caddy/Caddyfile"
ssh root@$IP 'cd /opt/caddy && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile'
```

Jeśli walidacja zgłasza brak `security_headers`, dopisz na początku `/opt/caddy/Caddyfile` blok `(security_headers)` z `deploy/caddy/Caddyfile`. Caddy sam pobiera certyfikat HTTPS.

**7. Sprawdzenie i przekazanie.**

```bash
curl -fsS "https://$HOST/api/health"   # pierwszy certyfikat może potrwać do minuty
```

Potem wyślij jedno prawdziwe zapytanie do głównego przepisu (curl albo strona). Podaj użytkownikowi adres `https://HOST` i przypomnij:
- warto mieć limit kredytów na kluczu OpenRouter,
- aplikacja jest publiczna: każdy z linkiem może z niej korzystać, ale najwyżej do dziennego budżetu `DAILY_BUDGET_USD` i z limitem zapytań na IP `RATE_LIMIT_PER_MINUTE`. Zmienia się je w `/opt/apps/NAZWA/.env`, potem `docker compose up -d` w tym folderze.

**8. Aktualizacje.** Krok 5 jeszcze raz (podgląd, `rsync`, `docker compose up -d --build`, `docker image prune`). Serwerowy `.env` zostaje, bo jest wykluczony z kopiowania. Caddy i DNS bez zmian. Wdrożenie zeruje dzienny licznik wydatków.

Kilka aplikacji na jednym VPS: każda ma swój folder w `/opt/apps`, swoją `NAZWA` i swój blok w Caddyfile. Caddy jest jeden. KVM 2 (2 vCPU, 8 GB RAM) spokojnie uciągnie kilka takich aplikacji.

**Gdy coś nie działa.**
- Logi aplikacji (tu są szczegóły błędów Jev): `ssh root@$IP "cd /opt/apps/${NAZWA:?} && docker compose logs --tail 100"`.
- Logi Caddy: `ssh root@$IP 'docker logs caddy --tail 100'`. Błąd certyfikatu zwykle oznacza, że DNS jeszcze nie wskazuje na IP albo porty są zamknięte.
- Strona się nie otwiera: sprawdź zaporę VPS (konektor albo panel). Muszą być otwarte TCP 80 i 443 (oraz 22 dla SSH). Do `docker-compose.yml` aplikacji nigdy nie dodawaj `ports:`: jedynym wejściem z internetu jest Caddy.
- „container name already in use”: `NAZWA` jest zajęta. Wybierz inną, popraw `APP_NAME` w `.env` i blok w Caddyfile.
- Caddy zwraca 502: kontener aplikacji nie działa albo ma inną nazwę (`ssh root@$IP 'docker ps'`).
