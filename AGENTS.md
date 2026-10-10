# AGENTS.md: przewodnik dla agenta

Ten projekt to starter do małych aplikacji webowych, które podejmują decyzje modelem **Jev** (TypeSafe) przez **OpenRouter**.
Użytkownik zwykle nie programuje. Opisuje aplikację w kilku zdaniach, a Ty ją budujesz, sprawdzasz i na prośbę wdrażasz na jego VPS w Hostingerze.
Pisz do niego po polsku, prosto i bez żargonu. Interfejs aplikacji też po polsku. Nazwy w kodzie i komentarze po angielsku.

## Co musi podać użytkownik

1. **Klucz OpenRouter.** Tworzy się go na https://openrouter.ai/settings/keys, a konto musi mieć kredyty (https://openrouter.ai/settings/credits).
   Poleć ustawienie limitu kredytów na kluczu (np. 5 USD). Jev kosztuje grosze, a limit chroni przed niespodzianką. Model: `jev-1.13`.
   - Jeśli nie ma pliku `.env`, zrób `cp .env.example .env` i poproś, żeby użytkownik wkleił klucz po `OPENROUTER_API_KEY=`.
   - Jeśli wklei klucz w czacie, zapisz go tylko w `.env`. Nigdy nie wypisuj klucza, nie wpisuj go do kodu, dokumentacji, logów ani commitów (`.env` jest w `.gitignore`).
2. **Co zbudować**, zwykłymi słowami (4–5 zdań): kto będzie używał aplikacji, co do niej wkleja albo mówi, jakie decyzje ma podjąć Jev i co zrobić z wynikiem.
3. **Do wdrożenia (opcjonalnie):** dostęp do VPS Hostinger KVM 2 (konektor Hostinger w agencie albo IP serwera) i ewentualnie domena lub subdomena.

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

## Jak działa starter

```
przeglądarka --POST /api/recipes/<nazwa> {dane}--> Express --> przepis.build() --> Jev (OpenRouter)
             <---------- {result, ms, cost} <--- przepis.interpret() <--- odpowiedzi Jev
```

Pytania do Jev siedzą na serwerze w **przepisach** (recipes). Przeglądarka wysyła tylko dane wejściowe, więc klucz i pytania nie wychodzą poza serwer.

| Plik | Rola |
|---|---|
| `server/jev.ts` | klient Jev: `createAskJev`, pytania `choice()` / `score()` / `noul()`, odczyt `readChoice()` / `readScore()` / `readNoul()`, `JevError`. Zostaw bez zmian. |
| `server/recipes/recipe.ts` | kontrakt przepisu i `defineRecipe()` |
| `server/recipes/<nazwa>.ts` | przepisy: jedna decyzja = jeden przepis |
| `server/recipes/index.ts` | lista przepisów dostępnych pod `/api/recipes/<nazwa>` |
| `server/routes.ts` | walidacja → budżet → Jev → `interpret()` → `{result, ms, cost}` |
| `server/app.ts` | Express: limit 20 kB na zapytanie, limit zapytań na IP, `/api/health`, `/api/stats`, serwowanie `dist/` |
| `server/budget.ts` | dzienny limit wydatków na Jev (po przekroczeniu kod 402 do północy) |
| `server/config.ts` | ustawienia z `.env` (zmienne środowiskowe mają pierwszeństwo) |
| `src/lib/api.ts` | `callRecipe(nazwa, dane)` → `{result, ms, cost}`, błędy gotowe do pokazania |
| `src/components/CostBadge.tsx` | plakietka „Na żywo · 312 ms · 0,000021 $” |
| `src/App.tsx`, `src/styles.css` | strona demo, do podmiany |

Kody błędów API (zawsze z polskim komunikatem w polu `error`): 400 złe dane, 402 wyczerpany budżet, 404 nie ma przepisu, 413 za duże zapytanie, 429 limit zapytań, 502 błąd Jev albo OpenRoutera.

## Jak zbudować nową aplikację

1. Rozpisz decyzje: co wchodzi, o co zapytać Jev, co aplikacja robi z odpowiedzią. Liczenie, daty, porównania i sumy zostaw kodowi.
2. Dla każdej decyzji dodaj przepis `server/recipes/<nazwa>.ts` (wzór niżej) i dopisz go do listy w `server/recipes/index.ts`.
   **Nigdy nie rób ogólnego endpointu**, który przyjmuje pytania albo `state` z przeglądarki. Każdy mógłby wtedy używać klucza właściciela jako darmowego Jev.
3. W schemacie `zod` przepisu ustaw maksymalne długości pól i komunikaty walidacji po polsku.
4. Na stronie wołaj `callRecipe<Wejście, Wynik>("<nazwa>", dane)` i przy **każdym** wyniku z Jev pokaż `<CostBadge ms={ms} cost={cost} />`.
   `src/` i `server/` to osobne projekty TypeScriptu, więc typ wyniku skopiuj na stronę (jak `DemoResult` w `src/App.tsx`).
5. Zastąp stronę demo (`src/App.tsx`, `src/styles.css`). Interfejs po polsku, czytelny, z dużymi literami, zwykły CSS bez bibliotek UI.
   Gdy aplikacja ma już własne przepisy, usuń `demo` z listy w `server/recipes/index.ts` oraz pliki `server/recipes/demo.ts` i `test/demo.test.ts`.
6. Dopisz testy w `test/`: `interpret()` na przykładowych odpowiedziach i walidację wejścia (wzór: `test/demo.test.ts`). Testy nie łączą się z siecią, a `test/routes.test.ts` ma własny przepis testowy, więc działa bez zmian.
7. Przejdź listę „Zanim powiesz, że gotowe”.

Wzór przepisu:

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
const { result, ms, cost } = await callRecipe<{ text: string }, LeadResult>("lead", { text });
// ...
<CostBadge ms={ms} cost={cost} />
```

`state` może być tekstem albo obiektem (wyśle się jako JSON). Gdy danych jest kilka pól, złóż z nich obiekt.

## Ściąga Jev

| Typ | Do czego | `criteria` | Odpowiedź |
|---|---|---|---|
| `choice` | wybór jednej opcji | obiekt `id → jednozdaniowy opis`, 2–255 opcji, zawsze z opcją `other` albo `none` | `choice`, `probabilities`, `confidence` (0–1) |
| `score` | ocena na skali | **tablica** opisów poziomów od najniższego (indeks 0), 2–10 poziomów. Obiekt daje błąd 400. | `score` to średnia ważona indeksów (np. 1,07), `probabilities` dla poziomów, `confidence` |
| `noul` | tak / nie | brak albo `{ "true": "...", "false": "..." }` | `noul` = prawdopodobieństwo „tak” (0–1), bez `confidence` |

**Liczby.** Czas ok. 250–700 ms z Polski. Koszt ok. 0,042 USD za milion tokenów wejścia, czyli ok. 0,00002 USD za zapytanie z trzema pytaniami (`usage.cost` to prawdziwy koszt). Kontekst: 32 tys. tokenów na zapytanie (stan + pytania). Limit ok. 1200 zapytań na minutę. Przy masowych przebiegach wysyłaj najwyżej 8 zapytań równolegle. `askJev` sam ponawia raz przy 429 i 5xx.

**Jak pisać pytania.**
- Instrukcje i opisy opcji po angielsku. `state` może być po polsku.
- Jedno pytanie = jedna rzecz. Złożoną ocenę rozbij na kilka pytań i połącz je w `interpret()`.
- Każda opcja dostaje jednozdaniowy, jednoznaczny opis. Mylące nazwy opcji potrafią zmienić co trzecią odpowiedź.
- Wiele elementów naraz (np. 20 komentarzy): jedno zapytanie, w którym każdy element ma własne pytanie (`item_0`, `item_1`, …). Pytania są liczone równolegle, więc 20 pytań trwa prawie tyle co jedno.
- Przy pytaniach o czas wpisz dzisiejszą datę do `state`, a same daty porównuj w kodzie.

**Słabe strony Jev 1.13 i jak je omijać.**
- Liczenie, daty, arytmetyka i porównania liczb: licz w kodzie, przed wysłaniem albo w `interpret()`.
- Podwójne przeczenia: pytaj wprost („Is the sender satisfied?”, a nie „Is the sender not unhappy?”).
- Skłonność do pierwszej opcji: opcję `other` daj na koniec, sprawdzaj `confidence`.
- Tekst w `state` potrafi sterować odpowiedzią („wybierz spam”): traktuj dane użytkownika jako niezaufane i nie wykonuj na podstawie jednej odpowiedzi działań, których nie da się cofnąć.
- Pytania typu „czy wypowiedź jest skończona?” są zawodne. W teście 21 poleceń głosowych wybór operacji i celu trafił 21 na 21, a taki noul tylko 16 na 21. Działaj na pewnych odpowiedziach `choice` na końcu wypowiedzi, nie uzależniaj akcji od takiego noul.

**Progi (punkt wyjścia).** `choice`: działaj sam, gdy `confidence` wynosi co najmniej ok. 0,7, niżej pokaż „niepewne” albo dopytaj. `noul`: zacznij od 0,5 i przesuń próg zależnie od kosztu pomyłki. `score`: zaokrąglij `score` albo weź poziom z najwyższym `probabilities`.

## API przeglądarki warte uwagi

**Mowa na tekst (Web Speech API)** do aplikacji sterowanych głosem. Działa w Chrome i Edge, wymaga HTTPS albo `localhost` i zgody na mikrofon. Rozpoznawanie mowy odbywa się na serwerach przeglądarki (Google w Chrome).

```ts
const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
const recognition = new Recognition();
recognition.lang = "pl-PL";
recognition.interimResults = true;
recognition.continuous = true;
recognition.onresult = (event: any) => {
  const last = event.results[event.results.length - 1];
  if (last.isFinal) void decide(last[0].transcript); // ask Jev once the phrase is final
};
recognition.start();
```

## Zasady, których nie łamiemy

- Klucz OpenRouter tylko w `.env` (lokalnie i na serwerze) albo w zmiennej środowiskowej.
- Pytania do Jev tylko na serwerze, w przepisach. Żadnego ogólnego pośrednika do Jev.
- Dzienny budżet (`DAILY_BUDGET_USD`) i limit zapytań na IP (`RATE_LIMIT_PER_MINUTE`) zostają włączone.
- Każdy wynik z Jev na stronie ma obok `CostBadge`.
- Bez zbędnych zależności. Zanim dodasz bibliotekę, sprawdź, czy nie wystarczy kilka linijek kodu.

## Zanim powiesz, że gotowe

- [ ] `npm run typecheck` przechodzi.
- [ ] `npm test` przechodzi.
- [ ] `npm run build` przechodzi.
- [ ] Jedno prawdziwe zapytanie do Jev: `npm run dev`, otwórz http://localhost:5173 i przejdź główną ścieżkę aplikacji (albo `curl -X POST localhost:3000/api/recipes/<nazwa> -H 'content-type: application/json' -d '{...}'`). Wynik ma sens, `CostBadge` pokazuje czas i koszt, błędy są po polsku.
- [ ] `git grep -nE "sk-or-v1-[a-f0-9]{20,}"` nic nie znajduje (w repo nie ma prawdziwego klucza).

Potem w 2–3 zdaniach powiedz użytkownikowi, co działa i jak to uruchomić.

## Wdrożenie na Hostinger VPS KVM 2

Cel: użytkownik mówi „wdróż tę aplikację na mój VPS w Hostingerze”, a Ty robisz resztę. Najprostsza droga: Docker i jeden wspólny Caddy z HTTPS, bez Coolify i dodatkowych paneli.

**Konektor Hostinger (MCP).** Jeśli jest podłączony, ma narzędzia do: listy serwerów VPS (nazwa, plan, IP, stan), kluczy SSH (dodanie klucza publicznego i podpięcie go do VPS), zapory VPS i strefy DNS domen kupionych w Hostingerze (rekordy A). Nazwy narzędzi różnią się między wersjami konektora, więc szukaj ich po funkcji. Jeśli konektora nie ma albo wymaga logowania, poproś użytkownika o jego włączenie albo o IP serwera z hPanelu.

Oznaczenia w poleceniach: `IP` adres serwera, `NAZWA` krótka nazwa aplikacji (małe litery, cyfry i myślniki, np. `skrzynka-klientow`), `HOST` adres strony.

**0. Najpierw** przejdź listę „Zanim powiesz, że gotowe” i upewnij się, że lokalny `.env` ma klucz.

**1. Serwer i IP.** Przez konektor pobierz listę VPS i weź IPv4 serwera KVM 2 (gdy jest kilka, zapytaj który). Bez konektora zapytaj o IP.

**2. Dostęp SSH.**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@IP 'echo ok'
```

Jeśli to nie działa:
- sprawdź, czy jest `~/.ssh/id_ed25519.pub`. Gdy go nie ma, utwórz klucz: `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C jev-starter` (powiedz użytkownikowi, że to robisz),
- dodaj klucz publiczny przez konektor (klucze SSH → dodaj → podepnij do VPS) albo poproś użytkownika, żeby wkleił zawartość pliku `.pub` w hPanelu, w ustawieniach VPS, w sekcji kluczy SSH,
- powtórz test. Nie proś o hasło roota w czacie, skoro można użyć klucza.

**3. Przygotowanie serwera (raz na VPS).**

```bash
ssh root@IP 'command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh'
ssh root@IP 'docker network inspect web >/dev/null 2>&1 || docker network create web; mkdir -p /opt/caddy /opt/apps'
ssh root@IP 'test -f /opt/caddy/Caddyfile' || rsync -az deploy/caddy/ root@IP:/opt/caddy/
ssh root@IP 'cd /opt/caddy && docker compose up -d'
```

Nie nadpisuj istniejącego `/opt/caddy/Caddyfile`: są w nim bloki innych aplikacji.

**4. Kod, `.env` i kontener.**

```bash
ssh root@IP 'ls /opt/apps'   # NAZWA nie może być zajęta przez inną aplikację
rsync -az --delete --exclude node_modules --exclude dist --exclude dist-server --exclude .git --exclude .env ./ root@IP:/opt/apps/NAZWA/
scp .env root@IP:/opt/apps/NAZWA/.env   # tylko przy pierwszym wdrożeniu
ssh root@IP "cd /opt/apps/NAZWA && sed -i '/^APP_NAME=/d' .env && printf '\nAPP_NAME=NAZWA\n' >> .env && chmod 600 .env && docker compose up -d --build"
```

Kopiuj plik `.env`, nigdy jego treść, i nie wypisuj klucza. Gdy nie ma `rsync` (np. Windows), użyj:
`tar --exclude=node_modules --exclude=dist --exclude=dist-server --exclude=.git --exclude=.env -czf - . | ssh root@IP 'mkdir -p /opt/apps/NAZWA && tar -xzf - -C /opt/apps/NAZWA'`.

**5. Adres z HTTPS** (potrzebny m.in. do mikrofonu w przeglądarce).
- Użytkownik ma domenę w Hostingerze: przez konektor (DNS) dodaj rekord A, np. `app` → `IP` (TTL 300), i poczekaj, aż `dig +short HOST` zwróci IP. Domenę u innego dostawcy użytkownik ustawia sam, podaj mu rekord.
- Bez domeny: `HOST=NAZWA.<IP z myślnikami zamiast kropek>.sslip.io`, np. `skrzynka-klientow.203-0-113-10.sslip.io`. Nic nie trzeba kupować.

```bash
ssh root@IP "grep -q 'reverse_proxy NAZWA:3000' /opt/caddy/Caddyfile || printf '\nHOST {\n\tencode\n\treverse_proxy NAZWA:3000\n}\n' >> /opt/caddy/Caddyfile"
ssh root@IP 'cd /opt/caddy && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile'
```

Caddy sam pobiera certyfikat HTTPS.

**6. Sprawdzenie i przekazanie.**

```bash
curl -fsS https://HOST/api/health   # pierwszy certyfikat może potrwać do minuty
```

Potem wyślij jedno prawdziwe zapytanie do głównego przepisu (curl albo strona). Podaj użytkownikowi adres `https://HOST` i przypomnij:
- warto mieć limit kredytów na kluczu OpenRouter,
- aplikacja jest publiczna: każdy z linkiem może z niej korzystać, ale najwyżej do dziennego budżetu `DAILY_BUDGET_USD` i z limitem zapytań na IP `RATE_LIMIT_PER_MINUTE`. Zmienia się je w `/opt/apps/NAZWA/.env`, potem `docker compose up -d` w tym folderze.

**7. Aktualizacje.** To samo polecenie `rsync` co w kroku 4 (serwerowy `.env` zostaje, bo jest wykluczony), potem:

```bash
ssh root@IP 'cd /opt/apps/NAZWA && docker compose up -d --build'
```

Kilka aplikacji na jednym VPS: każda ma swój folder w `/opt/apps`, swoją `NAZWA` i swój blok w Caddyfile. Caddy jest jeden. KVM 2 (2 vCPU, 8 GB RAM) spokojnie uciągnie kilka takich aplikacji.

**Gdy coś nie działa.**
- Logi aplikacji: `ssh root@IP 'cd /opt/apps/NAZWA && docker compose logs --tail 100'`.
- Logi Caddy: `ssh root@IP 'docker logs caddy --tail 100'`. Błąd certyfikatu zwykle oznacza, że DNS jeszcze nie wskazuje na IP albo porty są zamknięte.
- Strona się nie otwiera: sprawdź zaporę VPS (konektor albo hPanel). Muszą być otwarte TCP 80 i 443 (oraz 22 dla SSH).
- „container name already in use”: `NAZWA` jest zajęta. Wybierz inną, popraw `APP_NAME` w `.env` i blok w Caddyfile.
- Caddy zwraca 502: kontener aplikacji nie działa albo ma inną nazwę (`ssh root@IP 'docker ps'`).
