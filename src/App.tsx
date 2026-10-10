import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CostBadge } from "./components/CostBadge";
import { callRecipe, type RecipeResponse } from "./lib/api";
import { formatPercent } from "./lib/format";

// Mirrors DemoResult in server/recipes/demo.ts.
type Topic = "offer" | "complaint" | "question" | "spam" | "other";
interface DemoResult {
  topic: Topic;
  topicConfidence: number;
  urgency: number;
  annoyed: boolean;
  annoyedP: number;
}

const MAX_LENGTH = 2000;

const TOPIC_LABELS: Record<Topic, string> = {
  offer: "Zapytanie ofertowe",
  complaint: "Reklamacja",
  question: "Pytanie",
  spam: "Spam",
  other: "Inne",
};

const URGENCY_LABELS: Record<number, string> = {
  1: "Może poczekać kilka tygodni",
  2: "W ciągu dwóch tygodni",
  3: "W tym tygodniu",
  4: "W ciągu 1–2 dni",
  5: "Trzeba działać dziś",
};

const EXAMPLES = [
  {
    label: "Reklamacja",
    text: "Dzień dobry, trzeci raz piszę w sprawie faktury za wrzesień. Nadal nie dostałem korekty, a jutro muszę rozliczyć VAT. Proszę o pilny kontakt, bo powoli tracę cierpliwość.",
  },
  {
    label: "Zapytanie",
    text: "Cześć! Prowadzę małą piekarnię i szukam kogoś, kto zrobi nam prostą stronę z menu i zamówieniami. Ile by to kosztowało? Nie pali się, myślimy o starcie wiosną.",
  },
  {
    label: "Spam",
    text: "GRATULACJE!!! Twój adres e-mail wygrał nowy smartfon. Kliknij link w ciągu 24 godzin i podaj dane karty, aby odebrać nagrodę.",
  },
];

export default function App() {
  const [text, setText] = useState(EXAMPLES[0]!.text);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RecipeResponse<DemoResult> | null>(null);

  async function check() {
    if (loading || !text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResponse(await callRecipe<{ text: string }, DemoResult>("demo", { text }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coś poszło nie tak.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void check();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void check();
    }
  }

  const result = response?.result;

  return (
    <div className="page">
      <header>
        <p className="kicker">Jev Starter · demo</p>
        <h1>O co chodzi w tej wiadomości?</h1>
        <p className="lead">
          Jedno zapytanie do Jev zwraca trzy rodzaje odpowiedzi: wybór z listy, ocenę na skali i szansę na „tak”.
        </p>
      </header>

      <form className="panel" onSubmit={onSubmit}>
        <label className="label" htmlFor="message">
          Wiadomość od klienta
        </label>
        <textarea
          id="message"
          value={text}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Wklej tutaj wiadomość od klienta…"
        />
        <div className="actions">
          <button type="submit" className="button" disabled={loading || !text.trim()}>
            {loading ? "Sprawdzam…" : "Sprawdź"}
          </button>
          <span className="hint">albo Ctrl / ⌘ + Enter</span>
          <div className="examples">
            <span>Przykłady:</span>
            {EXAMPLES.map((example) => (
              <button key={example.label} type="button" className="chip" onClick={() => setText(example.text)}>
                {example.label}
              </button>
            ))}
            <span className="counter">
              {text.length} / {MAX_LENGTH}
            </span>
          </div>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="results-head">
        <h2>Odpowiedź Jev</h2>
        {response && (
          <CostBadge
            ms={response.ms}
            cost={response.cost}
            calls={response.calls}
            estimated={response.costEstimated}
          />
        )}
      </div>

      <section className={`cards${loading ? " is-loading" : ""}`} aria-live="polite">
        <ResultCard
          type="choice"
          title="Wybór"
          description="Jev wybiera jedną odpowiedź z listy, którą mu podajesz."
          question="Czego dotyczy wiadomość?"
        >
          <p className="card-value">{result ? TOPIC_LABELS[result.topic] : "—"}</p>
          <Meter value={result?.topicConfidence ?? 0} />
          <p className="card-sub">pewność {result ? formatPercent(result.topicConfidence) : "—"}</p>
        </ResultCard>

        <ResultCard
          type="score"
          title="Skala"
          description="Jev ocenia na skali, od najniższego do najwyższego poziomu."
          question="Jak pilna jest sprawa?"
        >
          <p className="card-value">{result ? `${result.urgency} / 5` : "—"}</p>
          <div className="scale" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((level) => (
              <span key={level} className={result && level <= result.urgency ? "on" : ""} />
            ))}
          </div>
          <p className="card-sub">{result ? URGENCY_LABELS[result.urgency] : "—"}</p>
        </ResultCard>

        <ResultCard
          type="noul"
          title="Tak / nie"
          description="Jev podaje prawdopodobieństwo, że odpowiedź brzmi „tak”."
          question="Czy nadawca jest zirytowany?"
        >
          <p className="card-value">{result ? (result.annoyed ? "Tak" : "Nie") : "—"}</p>
          <Meter value={result?.annoyedP ?? 0} />
          <p className="card-sub">szansa na „tak”: {result ? formatPercent(result.annoyedP) : "—"}</p>
        </ResultCard>
      </section>

      <footer className="footer">
        Klucz OpenRouter zostaje na serwerze. Przeglądarka wysyła tylko treść wiadomości, a pytania do Jev są zapisane w
        przepisie <code>server/recipes/demo.ts</code>.
      </footer>
    </div>
  );
}

function ResultCard(props: { type: string; title: string; description: string; question: string; children: ReactNode }) {
  return (
    <article className="card">
      <div className="card-head">
        <h3 className="card-title">{props.title}</h3>
        <span className="card-type">{props.type}</span>
      </div>
      <p className="card-desc">{props.description}</p>
      <p className="card-question">{props.question}</p>
      {props.children}
    </article>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="meter" aria-hidden="true">
      <span style={{ width: formatPercent(Math.min(1, Math.max(0, value))) }} />
    </div>
  );
}
