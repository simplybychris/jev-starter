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
  offer: "Quote request",
  complaint: "Complaint",
  question: "Question",
  spam: "Spam",
  other: "Other",
};

const URGENCY_LABELS: Record<number, string> = {
  1: "Can wait a few weeks",
  2: "Within two weeks",
  3: "This week",
  4: "Within 1–2 days",
  5: "Needs action today",
};

const EXAMPLES = [
  {
    label: "Complaint",
    text: "Hello, this is the third time I am writing about the September invoice. I still have not received the corrected one and I have to file my VAT return tomorrow. Please get back to me urgently, I am running out of patience.",
  },
  {
    label: "Quote request",
    text: "Hi! I run a small bakery and I am looking for someone to build us a simple website with our menu and online orders. How much would that cost? No rush, we are thinking about launching in spring.",
  },
  {
    label: "Spam",
    text: "CONGRATULATIONS!!! Your email address has won a brand new smartphone. Click the link within 24 hours and enter your card details to claim your prize.",
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
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
        <h1>What is this message about?</h1>
        <p className="lead">
          One Jev request returns three kinds of answers: a choice from a list, a score on a scale and the probability of “yes”.
        </p>
      </header>

      <form className="panel" onSubmit={onSubmit}>
        <label className="label" htmlFor="message">
          Message from a client
        </label>
        <textarea
          id="message"
          value={text}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Paste a message from a client…"
        />
        <div className="actions">
          <button type="submit" className="button" disabled={loading || !text.trim()}>
            {loading ? "Checking…" : "Check"}
          </button>
          <span className="hint">or Ctrl / ⌘ + Enter</span>
          <div className="examples">
            <span>Examples:</span>
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
        <h2>Jev’s answer</h2>
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
          title="Choice"
          description="Jev picks one answer from the list you give it."
          question="What is the message about?"
        >
          <p className="card-value">{result ? TOPIC_LABELS[result.topic] : "—"}</p>
          <Meter value={result?.topicConfidence ?? 0} />
          <p className="card-sub">confidence {result ? formatPercent(result.topicConfidence) : "—"}</p>
        </ResultCard>

        <ResultCard
          type="score"
          title="Score"
          description="Jev rates on a scale, from the lowest to the highest level."
          question="How urgent is it?"
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
          title="Yes / no"
          description="Jev gives the probability that the answer is “yes”."
          question="Is the sender annoyed?"
        >
          <p className="card-value">{result ? (result.annoyed ? "Yes" : "No") : "—"}</p>
          <Meter value={result?.annoyedP ?? 0} />
          <p className="card-sub">probability of “yes”: {result ? formatPercent(result.annoyedP) : "—"}</p>
        </ResultCard>
      </section>

      <footer className="footer">
        The OpenRouter key stays on the server. The browser only sends the message; the questions for Jev live in the
        recipe <code>server/recipes/demo.ts</code>.
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
