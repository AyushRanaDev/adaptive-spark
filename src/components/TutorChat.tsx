import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, ImagePlus, Trash2, ScanText } from "lucide-react";
import { askTutor, summarizeNotes } from "@/lib/learning.functions";

type Msg = { role: "user" | "assistant"; content: string };

/** Downscale + re-encode client side so the data URL stays small enough to POST. */
async function toCompactDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function TutorChat({ topic, context }: { topic: string; context: string }) {
  const ask = useServerFn(askTutor);
  const readNotes = useServerFn(summarizeNotes);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy("Thinking…");
    try {
      const { answer } = await ask({ data: { topic, context, notes, history, question } });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    try {
      const next = await Promise.all(Array.from(files).slice(0, 4).map(toCompactDataUrl));
      setImages((prev) => [...prev, ...next].slice(0, 4));
    } catch {
      setError("That file couldn't be read as an image.");
    }
  };

  const runOcr = async () => {
    if (!images.length || busy) return;
    setError(null);
    setBusy("Reading your notes…");
    try {
      const { notes: extracted } = await readNotes({ data: { topic, images } });
      setNotes(extracted);
      setMessages((m) => [
        ...m,
        { role: "user", content: `📄 Uploaded ${images.length} note image(s) — please read and summarise them.` },
        { role: "assistant", content: extracted },
      ]);
      setImages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read those notes.");
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="ember-fill fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle className="size-4" /> Ask the tutor
      </button>
    );
  }

  return (
    <div className="panel fixed bottom-4 right-4 z-40 flex h-[min(78vh,620px)] w-[min(94vw,420px)] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">AI study assistant</p>
          <p className="text-xs text-muted-foreground">Ask anything · upload notes for OCR</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ask a question about {topic || "your topic"}, or upload a photo of your handwritten notes — the tutor will
            transcribe, summarise and quiz you on them.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl rounded-br-sm border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
                : "max-w-full rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:mt-3 [&_h2]:text-base [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3"
            }
          >
            {m.role === "assistant" ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            ) : (
              m.content
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {busy}
          </p>
        )}
        {error && <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs">{error}</p>}
      </div>

      {images.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <div className="flex gap-2">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`Note ${i + 1}`} className="size-12 rounded-md border border-border object-cover" />
            ))}
          </div>
          <button
            onClick={runOcr}
            disabled={!!busy}
            className="ember-fill ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            <ScanText className="size-3.5" /> Summarise
          </button>
          <button onClick={() => setImages([])} className="text-muted-foreground hover:text-foreground">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void pickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          title="Upload note images"
          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <ImagePlus className="size-4" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Ask about this topic…"
          className="max-h-28 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || !!busy}
          className="ember-fill rounded-lg p-2.5 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
      {notes && (
        <p className="border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
          Notes attached — answers are grounded in them.
        </p>
      )}
    </div>
  );
}
