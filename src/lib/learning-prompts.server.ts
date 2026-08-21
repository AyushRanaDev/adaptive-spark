import { obj, arr, str, num } from "./ai-gateway.server";

export const questionSchema = obj({
  conceptId: str("id of the concept this question tests"),
  prompt: str(),
  options: arr(str()),
  correctIndex: num("0-based index of the correct option"),
  explanation: str("why the correct answer is correct, 1-3 sentences"),
  difficulty: num("1 = recall, 2 = application, 3 = transfer"),
  misconceptions: arr(str("for each option, the misconception it reveals; empty string for the correct option")),
});

export const TUTOR = `You are an expert adaptive tutor and learning scientist.
You design instruction using retrieval practice, worked examples, concrete analogies and misconception diagnosis.
Write in clear, warm, concise prose. Never be condescending. Never pad.
Every multiple-choice item has exactly 4 options and plausible distractors that map to real misconceptions.`;
