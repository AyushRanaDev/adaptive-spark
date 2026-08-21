import { useState } from "react";
import { Check, X, ChevronRight } from "lucide-react";
import type { Question } from "@/lib/learning-types";

export function QuizCard({
  question,
  index,
  total,
  onAnswer,
  labelPrefix = "Question",
}: {
  question: Question;
  index: number;
  total: number;
  onAnswer: (payload: { correct: boolean; misconception: string; difficulty: number }) => void;
  labelPrefix?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;
  const correct = picked === question.correctIndex;

  return (
    <div className="panel rise p-6 md:p-8">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>
          {labelPrefix} {index + 1} / {total}
        </span>
        <span>{["Recall", "Apply", "Transfer"][Math.min(2, Math.max(0, question.difficulty - 1))]}</span>
      </div>

      <h3 className="mt-4 text-2xl leading-snug">{question.prompt}</h3>

      <div className="mt-6 space-y-3">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correctIndex;
          const state = !revealed ? "idle" : isCorrect ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={[
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                state === "idle" && "border-border bg-card hover:border-primary/60 hover:bg-secondary",
                state === "right" && "border-success/70 bg-success/10",
                state === "wrong" && "border-destructive/70 bg-destructive/10",
                state === "dim" && "border-border/50 opacity-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                {state === "right" ? (
                  <Check className="size-3.5 text-success" />
                ) : state === "wrong" ? (
                  <X className="size-3.5 text-destructive" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="text-[0.975rem] leading-relaxed">{option}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="rise mt-6 rounded-xl border border-border bg-card p-5">
          <p className={`text-sm font-medium ${correct ? "text-success" : "text-destructive"}`}>
            {correct ? "Correct" : "Not quite"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
          {!correct && question.misconceptions[picked!] && (
            <p className="mt-3 border-l-2 border-primary/60 pl-3 text-sm leading-relaxed text-foreground/85">
              <span className="text-primary">Misconception detected: </span>
              {question.misconceptions[picked!]}
            </p>
          )}
          <button
            onClick={() =>
              onAnswer({
                correct,
                misconception: correct ? "" : (question.misconceptions[picked!] ?? ""),
                difficulty: question.difficulty,
              })
            }
            className="ember-fill mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5"
          >
            Continue <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
