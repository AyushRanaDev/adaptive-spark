export type Question = {
  conceptId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: number; // 1 easy .. 3 hard
  misconceptions: string[]; // one per option, "" for the correct one
};

export type Concept = {
  id: string;
  name: string;
  description: string;
};

export type Curriculum = {
  title: string;
  overview: string;
  concepts: Concept[];
  diagnostic: Question[];
};

export type Lesson = {
  conceptId: string;
  title: string;
  hook: string;
  body: string; // markdown
  analogy: string;
  pitfall: string;
  checkpoints: Question[];
};

export type ConceptState = {
  mastery: number; // 0..1
  attempts: number;
  correct: number;
  misconceptions: string[];
};

export type KnowledgeState = Record<string, ConceptState>;

export const initialConceptState = (seed: number): ConceptState => ({
  mastery: seed,
  attempts: 0,
  correct: 0,
  misconceptions: [],
});

/** Bayesian-flavoured mastery update: harder items move the needle more. */
export function updateMastery(state: ConceptState, correct: boolean, difficulty: number): ConceptState {
  const weight = 0.18 + 0.12 * difficulty;
  const mastery = correct
    ? state.mastery + (1 - state.mastery) * weight
    : state.mastery - state.mastery * (weight + 0.1);
  return {
    ...state,
    mastery: Math.min(0.99, Math.max(0.02, Number(mastery.toFixed(3)))),
    attempts: state.attempts + 1,
    correct: state.correct + (correct ? 1 : 0),
  };
}

export function masteryLabel(m: number) {
  if (m >= 0.85) return "Mastered";
  if (m >= 0.65) return "Solid";
  if (m >= 0.4) return "Developing";
  if (m >= 0.2) return "Shaky";
  return "New";
}

/** Next concept to study: the least-mastered one, earliest in the sequence on ties. */
export function nextConcept(concepts: Concept[], ks: KnowledgeState): Concept | null {
  const pending = concepts.filter((c) => (ks[c.id]?.mastery ?? 0) < 0.85);
  if (pending.length === 0) return null;
  return pending.reduce((a, b) => ((ks[a.id]?.mastery ?? 0) <= (ks[b.id]?.mastery ?? 0) ? a : b));
}
