import type { Concept, KnowledgeState } from "@/lib/learning-types";
import { masteryLabel } from "@/lib/learning-types";

export function KnowledgeMap({
  concepts,
  knowledge,
  activeId,
}: {
  concepts: Concept[];
  knowledge: KnowledgeState;
  activeId?: string | null | undefined;
}) {
  const overall =
    concepts.reduce((sum, c) => sum + (knowledge[c.id]?.mastery ?? 0), 0) / Math.max(1, concepts.length);

  return (
    <aside className="panel h-fit p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl">Knowledge state</h2>
        <span className="ember-text text-2xl font-medium">{Math.round(overall * 100)}%</span>
      </div>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Live learner model</p>

      <div className="mt-6 space-y-5">
        {concepts.map((c) => {
          const st = knowledge[c.id];
          const m = st?.mastery ?? 0;
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              className={`rounded-lg px-2 py-1.5 transition-colors ${active ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="shrink-0 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {masteryLabel(m)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="ember-fill h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(3, m * 100)}%` }}
                />
              </div>
              {st && st.attempts > 0 && (
                <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                  {st.correct}/{st.attempts} correct
                  {st.misconceptions.length > 0 && ` · ${st.misconceptions.length} misconception(s) tracked`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
