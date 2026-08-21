import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Sparkles,
  Loader2,
  Lightbulb,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  Send,
  Trophy,
} from "lucide-react";
import { buildCurriculum, buildLesson, coachFeedback } from "@/lib/learning.functions";
import {
  initialConceptState,
  updateMastery,
  nextConcept,
  type Curriculum,
  type KnowledgeState,
  type Lesson,
} from "@/lib/learning-types";
import { QuizCard } from "@/components/QuizCard";
import { KnowledgeMap } from "@/components/KnowledgeMap";

type Phase = "setup" | "diagnostic" | "map" | "lesson" | "checkpoint" | "explain" | "done";
type Coach = { verdict: string; feedback: string; nextStep: string; score: number };

const STORAGE_KEY = "cognita-session-v1";

const EXAMPLES = ["Bayes' theorem", "How transformers work", "Photosynthesis", "React rendering & reconciliation"];

export function LearningApp() {
  const runCurriculum = useServerFn(buildCurriculum);
  const runLesson = useServerFn(buildLesson);
  const runCoach = useServerFn(coachFeedback);

  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [selfRating, setSelfRating] = useState(0.25);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeState>({});
  const [qIndex, setQIndex] = useState(0);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [coach, setCoach] = useState<Coach | null>(null);

  // restore / persist the learner model
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.curriculum) {
        setCurriculum(s.curriculum);
        setKnowledge(s.knowledge ?? {});
        setTopic(s.topic ?? "");
        setGoal(s.goal ?? "");
        setPhase("map");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!curriculum) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ curriculum, knowledge, topic, goal }));
  }, [curriculum, knowledge, topic, goal]);

  const concepts = curriculum?.concepts ?? [];
  const upNext = useMemo(() => (curriculum ? nextConcept(concepts, knowledge) : null), [curriculum, concepts, knowledge]);

  const guard = useCallback(async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }, []);

  const start = () =>
    guard("Mapping the concept space and calibrating a diagnostic…", async () => {
      const data = await runCurriculum({ data: { topic, goal, selfRating } });
      setCurriculum(data);
      setKnowledge(Object.fromEntries(data.concepts.map((c) => [c.id, initialConceptState(selfRating * 0.6)])));
      setQIndex(0);
      setPhase("diagnostic");
    });

  const recordAnswer = (conceptId: string, correct: boolean, misconception: string, difficulty: number) => {
    setKnowledge((prev) => {
      const base = prev[conceptId] ?? initialConceptState(0.2);
      const updated = updateMastery(base, correct, difficulty);
      return {
        ...prev,
        [conceptId]: {
          ...updated,
          misconceptions: misconception
            ? Array.from(new Set([...base.misconceptions, misconception])).slice(-4)
            : base.misconceptions,
        },
      };
    });
  };

  const openLesson = (conceptId: string, mode: "standard" | "simpler" | "example" | "deeper" = "standard") => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return;
    setActiveConceptId(conceptId);
    setCoach(null);
    setExplanation("");
    guard(`Writing an adaptive lesson on ${concept.name}…`, async () => {
      const data = await runLesson({
        data: {
          topic: curriculum!.title,
          conceptId: concept.id,
          conceptName: concept.name,
          conceptDescription: concept.description,
          mastery: knowledge[concept.id]?.mastery ?? 0.2,
          misconceptions: knowledge[concept.id]?.misconceptions ?? [],
          mode,
        },
      });
      setLesson(data);
      setQIndex(0);
      setPhase("lesson");
    });
  };

  const submitExplanation = () =>
    guard("Reading your explanation…", async () => {
      const concept = concepts.find((c) => c.id === activeConceptId);
      const data = await runCoach({
        data: {
          topic: curriculum!.title,
          conceptName: concept?.name ?? "",
          question: `Explain ${concept?.name} in your own words.`,
          learnerAnswer: explanation,
          correctAnswer: lesson?.body.slice(0, 1200) ?? concept?.description ?? "",
        },
      });
      setCoach(data);
      if (activeConceptId) {
        setKnowledge((prev) => {
          const base = prev[activeConceptId] ?? initialConceptState(0.2);
          const blended = base.mastery * 0.65 + data.score * 0.35;
          return { ...prev, [activeConceptId]: { ...base, mastery: Number(blended.toFixed(3)) } };
        });
      }
    });

  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCurriculum(null);
    setKnowledge({});
    setLesson(null);
    setPhase("setup");
    setTopic("");
    setGoal("");
  };

  /* ---------------------------------- views --------------------------------- */

  const Busy = busy ? (
    <div className="panel rise flex items-center gap-3 p-6">
      <Loader2 className="size-5 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{busy}</p>
    </div>
  ) : null;

  const Err = error ? (
    <div className="rise mt-4 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-sm text-foreground/90">{error}</p>
    </div>
  ) : null;

  if (phase === "setup") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-16">
        <div className="rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Brain className="size-3.5 text-primary" /> Adaptive learning intelligence
          </div>
          <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl">
            Learning that <span className="ember-text">rewrites itself</span> around what you already know.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Cognita builds a concept map for any topic, probes your knowledge with a diagnostic, tracks mastery and
            misconceptions per concept, and then teaches only what you're missing — in the way you need it.
          </p>
        </div>

        <div className="panel rise mt-10 p-6 md:p-8">
          <label className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">
            What do you want to learn?
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Bayes' theorem"
            className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 text-lg outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => setTopic(e)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {e}
              </button>
            ))}
          </div>

          <label className="mt-7 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Your goal (optional)
          </label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Pass an exam, build intuition, teach it to someone…"
            className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />

          <label className="mt-7 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Prior knowledge — {Math.round(selfRating * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={selfRating * 100}
            onChange={(e) => setSelfRating(Number(e.target.value) / 100)}
            className="mt-3 w-full accent-[var(--primary)]"
          />
          <div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground">
            <span>Total beginner</span>
            <span>Confident</span>
          </div>

          <button
            disabled={topic.trim().length < 2 || !!busy}
            onClick={start}
            className="ember-fill mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Build my learning path
          </button>
          {busy && <p className="mt-4 text-center text-sm text-muted-foreground">{busy}</p>}
          {Err}
        </div>
      </main>
    );
  }

  if (!curriculum) return null;

  /* diagnostic */
  if (phase === "diagnostic") {
    const q = curriculum.diagnostic[qIndex];
    return (
      <Shell title={curriculum.title} subtitle="Diagnostic — calibrating your learner model" onReset={reset}>
        <div className="space-y-6">
          {q ? (
            <QuizCard
              key={qIndex}
              question={q}
              index={qIndex}
              total={curriculum.diagnostic.length}
              labelPrefix="Probe"
              onAnswer={({ correct, misconception, difficulty }) => {
                recordAnswer(q.conceptId, correct, misconception, difficulty);
                if (qIndex + 1 < curriculum.diagnostic.length) setQIndex(qIndex + 1);
                else setPhase("map");
              }}
            />
          ) : null}
        </div>
        <KnowledgeMap concepts={concepts} knowledge={knowledge} activeId={q?.conceptId} />
      </Shell>
    );
  }

  /* concept map / dashboard */
  if (phase === "map") {
    return (
      <Shell title={curriculum.title} subtitle={curriculum.overview} onReset={reset}>
        <div className="space-y-6">
          {busy ? (
            Busy
          ) : upNext ? (
            <div className="panel rise glow p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Adaptive next step</p>
              <h2 className="mt-3 text-3xl">{upNext.name}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{upNext.description}</p>
              <p className="mt-4 text-sm text-foreground/80">
                Chosen because your mastery here is the lowest in the map (
                {Math.round((knowledge[upNext.id]?.mastery ?? 0) * 100)}%)
                {knowledge[upNext.id]?.misconceptions.length
                  ? `, and you showed a misconception: “${knowledge[upNext.id]!.misconceptions.at(-1)}”`
                  : ""}
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => openLesson(upNext.id)}
                  className="ember-fill inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                >
                  Teach me this <ArrowRight className="size-4" />
                </button>
                <button
                  onClick={() => openLesson(upNext.id, "example")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-primary/60"
                >
                  <Layers className="size-4" /> Worked example instead
                </button>
              </div>
            </div>
          ) : (
            <div className="panel rise p-8 text-center">
              <Trophy className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 text-3xl">Topic mastered</h2>
              <p className="mt-2 text-muted-foreground">
                Every concept is above 85% mastery. Push deeper or start a new topic.
              </p>
              <button
                onClick={() => openLesson(concepts[concepts.length - 1]?.id ?? "", "deeper")}
                className="ember-fill mt-6 rounded-lg px-4 py-2.5 text-sm font-semibold"
              >
                Go deeper
              </button>
            </div>
          )}

          <div className="panel p-6">
            <h3 className="text-lg">All concepts</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {concepts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openLesson(c.id, (knowledge[c.id]?.mastery ?? 0) > 0.85 ? "deeper" : "standard")}
                  className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/60"
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                </button>
              ))}
            </div>
          </div>
          {Err}
        </div>
        <KnowledgeMap concepts={concepts} knowledge={knowledge} activeId={upNext?.id} />
      </Shell>
    );
  }

  /* lesson + checkpoints + explain-back */
  if (lesson && (phase === "lesson" || phase === "checkpoint" || phase === "explain")) {
    const cp = lesson.checkpoints[qIndex];
    return (
      <Shell title={curriculum.title} subtitle={`Now teaching · ${lesson.title}`} onReset={reset}>
        <div className="space-y-6">
          {phase === "lesson" && (
            <div className="panel rise p-6 md:p-8">
              <h2 className="text-3xl leading-tight">{lesson.title}</h2>
              <p className="mt-3 italic text-primary">{lesson.hook}</p>

              <div className="mt-6 space-y-4 text-[0.97rem] leading-[1.75] text-foreground/90 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h2]:mt-6 [&_h2]:text-2xl [&_h3]:mt-5 [&_h3]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-4 [&_strong]:text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body}</ReactMarkdown>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-accent">
                    <Lightbulb className="size-3.5" /> Analogy
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{lesson.analogy}</p>
                </div>
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-destructive">
                    <AlertTriangle className="size-3.5" /> Common pitfall
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{lesson.pitfall}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setQIndex(0);
                    setPhase("checkpoint");
                  }}
                  className="ember-fill inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                >
                  I'm ready — check me <ArrowRight className="size-4" />
                </button>
                <button
                  onClick={() => openLesson(lesson.conceptId, "simpler")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-primary/60"
                >
                  <RotateCcw className="size-4" /> Explain it differently
                </button>
                <button
                  onClick={() => setPhase("map")}
                  className="rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Back to map
                </button>
              </div>
            </div>
          )}

          {phase === "checkpoint" &&
            (cp ? (
              <QuizCard
                key={qIndex}
                question={cp}
                index={qIndex}
                total={lesson.checkpoints.length}
                labelPrefix="Checkpoint"
                onAnswer={({ correct, misconception, difficulty }) => {
                  recordAnswer(lesson.conceptId, correct, misconception, difficulty);
                  if (qIndex + 1 < lesson.checkpoints.length) setQIndex(qIndex + 1);
                  else setPhase("explain");
                }}
              />
            ) : null)}

          {phase === "explain" && (
            <div className="panel rise p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Explain-back</p>
              <h2 className="mt-3 text-2xl">Teach it back in your own words</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Free recall is the strongest signal of real understanding — and of what's still fuzzy.
              </p>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={6}
                placeholder={`Explain ${lesson.title} as if to a curious friend…`}
                className="mt-4 w-full resize-y rounded-xl border border-input bg-card p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={explanation.trim().length < 10 || !!busy}
                  onClick={submitExplanation}
                  className="ember-fill inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Get coaching
                </button>
                <button
                  onClick={() => setPhase("map")}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-primary/60"
                >
                  Back to map
                </button>
              </div>

              {coach && (
                <div className="rise mt-6 rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-medium text-primary">{coach.verdict}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">{coach.feedback}</p>
                  <p className="mt-3 border-l-2 border-accent pl-3 text-sm text-muted-foreground">
                    Next: {coach.nextStep}
                  </p>
                </div>
              )}
              {Err}
            </div>
          )}

          {busy && phase !== "explain" && Busy}
          {phase !== "explain" && Err}
        </div>
        <KnowledgeMap concepts={concepts} knowledge={knowledge} activeId={lesson.conceptId} />
      </Shell>
    );
  }

  return null;
}

function Shell({
  title,
  subtitle,
  onReset,
  children,
}: {
  title: string;
  subtitle: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const [main, sidebar] = children as React.ReactNode[];
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Brain className="size-3.5 text-primary" /> Cognita
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          New topic
        </button>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>{main}</div>
        {sidebar}
      </div>
    </main>
  );
}
