"use client";

import { useState } from "react";
import { callCost, fmtCost, modelInfo } from "@/ai/models";
import { useTroop, type Arranged } from "@/state/store";
import { RoughButton } from "./ui/rough";

// One sentence to a jam. The arranger reads it once (a cheap model call, or keywords with no
// key), sets the band up and the engine plays it. What it chose shows in the panel right below
// (the same controls edit it), so here there's only the sentence and a line on how it was read.

const EXAMPLES = ["rainy-night Monk ballad, slow, brushes", "sunny bossa with flute in F, club", "Blue Bossa twice, sax trio", "a slow waltz for solo piano in a hall"];

const fmtTokens = (n: number | null | undefined) => (n == null ? "?" : n.toLocaleString("en-US"));
/** A brief costs fractions of a cent, so show them ("$0.0003") rather than "<$0.01". */
const fmtSmallCost = (usd: number) => (usd >= 0.01 ? fmtCost(usd) : `$${usd.toPrecision(1)}`);

/** How the last sentence was read, in full: which model, its tokens and what it cost, or that keywords did it. */
function howRead(a: Arranged): string {
  if (a.source === "keywords") return "Read from keywords, no model call";
  const name = a.model ? (modelInfo(a.model)?.label ?? a.model) : "the model";
  if (a.source === "fallback") return `${name} didn’t answer usefully, so keywords stood in`;
  const cost = a.model ? callCost(a.model, a.usage) : null;
  return `${name} · ${fmtTokens(a.usage?.inputTokens)} in / ${fmtTokens(a.usage?.outputTokens)} out${cost !== null ? ` · ≈ ${fmtSmallCost(cost)}` : ""}`;
}

/** The same, said short: the model and the cost. */
function howReadShort(a: Arranged): string {
  if (a.source !== "model") return "keywords";
  const name = a.model ? (modelInfo(a.model)?.label ?? a.model) : "the model";
  const cost = a.model ? callCost(a.model, a.usage) : null;
  return cost !== null ? `${name} · ≈ ${fmtSmallCost(cost)}` : name;
}

export function Arranger() {
  const [text, setText] = useState("");
  const arranging = useTroop((x) => x.arranging);
  const arranged = useTroop((x) => x.arranged);
  const busy = useTroop((x) => x.gen.running);
  const arrangeFrom = useTroop((x) => x.arrangeFrom);
  const clearArranged = useTroop((x) => x.clearArranged);

  const submit = () => {
    if (!text.trim() || arranging) return;
    void arrangeFrom(text);
  };

  return (
    <section className="mb-m" aria-label="Ask for a jam">
      <label htmlFor="arranger-input" className="sr-only">
        Ask for a jam
      </label>
      <form
        className="flex items-end gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* examples come up as suggestions when the box is focused */}
        <input
          id="arranger-input"
          type="text"
          className="sketch-input min-w-0 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask for a jam…"
          list="arranger-examples"
          maxLength={400}
          autoComplete="off"
          enterKeyHint="go"
          disabled={busy}
        />
        <datalist id="arranger-examples">
          {EXAMPLES.map((ex) => (
            <option key={ex} value={ex} />
          ))}
        </datalist>
        <RoughButton seed="arrange" tone="primary" type="submit" disabled={arranging || busy || !text.trim()} className="tap shrink-0 px-s py-xxs font-brand text-l font-heavy text-on-accent" aria-busy={arranging}>
          {arranging ? "Arranging…" : "Arrange"}
        </RoughButton>
      </form>

      {arranged && (
        <p className="mt-xxs flex items-center gap-xxs text-xs text-ink-soft" role="status">
          <span className="min-w-0 flex-1 truncate" title={[arranged.note && `“${arranged.note}”`, howRead(arranged), arranged.repairs.length > 0 && arranged.source === "model" && `mended: ${arranged.repairs.join("; ")}`].filter(Boolean).join("\n")}>
            {arranged.missed ? (
              // nothing was read, so nothing changed: say what it listens for
              <span className="text-ink">Try a style, an artist or a tune</span>
            ) : (
              <>
                {arranged.note && <span className="italic text-ink">“{arranged.note}” · </span>}
                {howReadShort(arranged)}
              </>
            )}
          </span>
          <button
            type="button"
            className="tap shrink-0 text-m text-ink-soft transition-colors duration-(--motion-duration) hover:text-ink"
            onClick={() => (clearArranged(), setText(""))}
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}
    </section>
  );
}
