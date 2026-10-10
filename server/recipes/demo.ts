import { z } from "zod";
import { choice, noul, readChoice, readNoul, readScore, score } from "../jev.js";
import { defineRecipe } from "./recipe.js";

/**
 * Example recipe: one Jev request with all three question types.
 * Input: a message from a client (Polish is fine).
 */

export const TOPICS = ["offer", "complaint", "question", "spam", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export interface DemoResult {
  topic: Topic;
  /** 0-1, how sure Jev is about the topic. */
  topicConfidence: number;
  /** 1 = can wait weeks, 5 = needs action today. */
  urgency: number;
  annoyed: boolean;
  /** 0-1, probability that the sender is annoyed. */
  annoyedP: number;
}

const MESSAGE_REQUIRED = "Wpisz treść wiadomości.";

export const demo = defineRecipe({
  name: "demo",

  input: z.object({
    text: z
      .string({ error: MESSAGE_REQUIRED })
      .trim()
      .min(1, MESSAGE_REQUIRED)
      .max(2000, "Wiadomość może mieć najwyżej 2000 znaków."),
  }),

  build: ({ text }) => ({
    state: `Message from a client to a small business (it may be written in Polish):\n\n${text}`,
    questions: {
      topic: choice("What is the main purpose of this message?", {
        offer: "The sender asks for a price quote or proposes a new order or cooperation.",
        complaint: "The sender complains about a product, service, invoice or delay and expects a fix.",
        question: "The sender asks a question or wants information, without complaining.",
        spam: "Unsolicited advertising, a scam, phishing or a mass mailing.",
        other: "None of the above.",
      }),
      urgency: score("How soon does the business need to act on this message?", [
        "It can wait several weeks; there is no time pressure.",
        "It should be handled within the next two weeks.",
        "It should be handled this week.",
        "It should be handled within a day or two.",
        "It needs action today.",
      ]),
      annoyed: noul("Is the sender annoyed or frustrated?"),
    },
  }),

  interpret: (answers): DemoResult => {
    const topic = readChoice(answers, "topic");
    const urgency = readScore(answers, "urgency");
    const annoyed = readNoul(answers, "annoyed");
    const knownTopic = (TOPICS as readonly string[]).includes(topic.choice);

    return {
      topic: knownTopic ? (topic.choice as Topic) : "other",
      topicConfidence: topic.confidence,
      // score is a weighted mean of level indexes 0-4; the app shows levels 1-5.
      urgency: Math.min(5, Math.max(1, Math.round(urgency.score) + 1)),
      annoyed: annoyed.noul >= 0.5,
      annoyedP: annoyed.noul,
    };
  },
});
