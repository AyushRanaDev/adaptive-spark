import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateJson, obj, arr, str, num } from "./ai-gateway.server";
import type { Curriculum, Lesson } from "./learning-types";

const questionSchema = obj({
  conceptId: str("id of the concept this question tests"),
  prompt: str(),
  options: arr(str()),
  correctIndex: num("0-based index of the correct option"),
  explanation: str("why the correct answer is correct, 1-3 sentences"),
  difficulty: num("1 = recall, 2 = application, 3 = transfer"),
  misconceptions: arr(str("for each option, the misconception it reveals; empty string for the correct option")),
});

const TUTOR = `You are an expert adaptive tutor and learning scientist.
You design instruction using retrieval practice, worked examples, concrete analogies and misconception diagnosis.
Write in clear, warm, concise prose. Never be condescending. Never pad.
Every multiple-choice item has exactly 4 options and plausible distractors that map to real misconceptions.`;

export const buildCurriculum = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().min(2).max(120),
        goal: z.string().max(300).default(""),
        selfRating: z.number().min(0).max(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return await generateJson<Curriculum>({
      system: TUTOR,
      schemaName: "curriculum",
      effort: "medium",
      schema: obj({
        title: str("short course title"),
        overview: str("2-3 sentences on what mastery of this topic looks like"),
        concepts: arr(obj({ id: str("kebab-case id"), name: str(), description: str("one sentence") })),
        diagnostic: arr(questionSchema),
      }),
      prompt: `Learner wants to learn: "${data.topic}".
Their stated goal: "${data.goal || "general understanding"}".
Self-rated prior knowledge: ${Math.round(data.selfRating * 100)} / 100.

Produce a concept map of 5 concepts ordered from prerequisite to advanced, and a diagnostic quiz of exactly 6 questions
that spans those concepts (at least one per concept) with mixed difficulty calibrated to the self-rating.
Distractors must diagnose specific misconceptions.`,
    });
  });

export const buildLesson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string(),
        conceptId: z.string(),
        conceptName: z.string(),
        conceptDescription: z.string(),
        mastery: z.number(),
        misconceptions: z.array(z.string()).max(10),
        mode: z.enum(["standard", "simpler", "example", "deeper"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const modeHint = {
      standard: "Teach it at a level matched to the mastery estimate.",
      simpler: "The learner did not get the previous explanation. Re-teach from scratch, far more concretely, no jargon.",
      example: "Teach almost entirely through a fully worked example, narrating each step and the decision behind it.",
      deeper: "The learner already has this. Go deeper: edge cases, why it works, connections to adjacent ideas.",
    }[data.mode];

    return await generateJson<Lesson>({
      system: TUTOR,
      schemaName: "lesson",
      effort: "low",
      schema: obj({
        conceptId: str(),
        title: str(),
        hook: str("one sentence on why this matters"),
        body: str("markdown lesson, 200-350 words, may use headings, lists and code"),
        analogy: str("a vivid concrete analogy, 1-2 sentences"),
        pitfall: str("the most common mistake learners make here"),
        checkpoints: arr(questionSchema),
      }),
      prompt: `Topic: ${data.topic}
Concept: ${data.conceptName} — ${data.conceptDescription} (id: ${data.conceptId})
Current mastery estimate: ${Math.round(data.mastery * 100)}/100.
Observed misconceptions from earlier answers: ${data.misconceptions.length ? data.misconceptions.join("; ") : "none yet"}.

${modeHint}
Directly address any observed misconception. Then write exactly 2 checkpoint questions (conceptId "${data.conceptId}")
that test understanding rather than recall.`,
    });
  });

export const coachFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string(),
        conceptName: z.string(),
        question: z.string(),
        learnerAnswer: z.string().min(1).max(2000),
        correctAnswer: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return await generateJson<{ verdict: string; feedback: string; nextStep: string; score: number }>({
      system: TUTOR,
      schemaName: "feedback",
      effort: "low",
      schema: obj({
        verdict: str("one of: correct, partially correct, incorrect"),
        feedback: str("2-4 sentences of specific, kind, actionable feedback referencing the learner's words"),
        nextStep: str("one concrete next action"),
        score: num("0 to 1 quality of the learner's explanation"),
      }),
      prompt: `Topic: ${data.topic}. Concept: ${data.conceptName}.
Question asked: ${data.question}
Reference answer: ${data.correctAnswer}
Learner's answer in their own words: """${data.learnerAnswer}"""
Grade it and coach them.`,
    });
  });
