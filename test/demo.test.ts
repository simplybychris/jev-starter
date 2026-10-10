import { describe, expect, it } from "vitest";
import type { JevAnswers } from "../server/jev.js";
import { demo } from "../server/recipes/demo.js";

function answers(topic: string, confidence: number, urgencyScore: number, annoyedP: number): JevAnswers {
  return {
    topic: { type: "choice", choice: topic, probabilities: { [topic]: confidence }, confidence },
    urgency: {
      type: "score",
      score: urgencyScore,
      legend: {},
      probabilities: {},
      confidence: 0.9,
    },
    annoyed: { type: "noul", noul: annoyedP },
  };
}

describe("demo recipe", () => {
  it("validates the input", () => {
    expect(demo.input.safeParse({ text: "  Hello  " })).toMatchObject({
      success: true,
      data: { text: "Hello" },
    });
    expect(demo.input.safeParse({ text: "   " }).success).toBe(false);
    expect(demo.input.safeParse({}).success).toBe(false);
    expect(demo.input.safeParse({ text: "a".repeat(2001) }).success).toBe(false);
  });

  it("builds one request with choice, score and noul questions", () => {
    const { state, questions } = demo.build({ text: "The invoice is wrong." });
    expect(state).toContain("The invoice is wrong.");
    expect(questions.topic?.type).toBe("choice");
    expect(Object.keys((questions.topic as { criteria: object }).criteria)).toEqual([
      "offer",
      "complaint",
      "question",
      "spam",
      "other",
    ]);
    expect(questions.urgency?.type).toBe("score");
    expect(Array.isArray(questions.urgency?.criteria)).toBe(true);
    expect((questions.urgency?.criteria as string[]).length).toBe(5);
    expect(questions.annoyed?.type).toBe("noul");
  });

  it("interprets probabilities into the app result", () => {
    expect(demo.interpret(answers("complaint", 0.97, 3.4, 0.82), { text: "x" })).toEqual({
      topic: "complaint",
      topicConfidence: 0.97,
      urgency: 4,
      annoyed: true,
      annoyedP: 0.82,
    });
  });

  it("rounds and clamps urgency to 1-5 and uses 0.5 as the annoyed threshold", () => {
    expect(demo.interpret(answers("spam", 1, 0, 0.49), { text: "x" })).toMatchObject({ urgency: 1, annoyed: false });
    expect(demo.interpret(answers("offer", 1, 4, 0.5), { text: "x" })).toMatchObject({ urgency: 5, annoyed: true });
    expect(demo.interpret(answers("offer", 1, 1.5, 0.1), { text: "x" })).toMatchObject({ urgency: 3 });
  });

  it("falls back to other for an unknown topic", () => {
    expect(demo.interpret(answers("weather", 0.6, 1, 0.1), { text: "x" }).topic).toBe("other");
  });
});
