// Reasoning models (e.g. DeepSeek-R1 distills) stream their chain-of-thought
// wrapped in <think>...</think> before the actual answer, all in one content
// stream. This splits an accumulated stream into the reasoning (shown as a live
// "thinking" peek) and the answer (shown as the reply).
const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

export interface ReasoningResult {
  reasoning: string;
  answer: string;
  isReasoning: boolean;
}

export function parseReasoning(content: string | null | undefined): ReasoningResult {
  const text = content ?? "";

  const closeIdx = text.indexOf(CLOSE_TAG);
  if (closeIdx >= 0) {
    // Reasoning is complete; everything after </think> is the answer.
    const reasoning = stripOpenTag(text.slice(0, closeIdx)).trim();
    const answer = text.slice(closeIdx + CLOSE_TAG.length).trimStart();
    return { reasoning, answer, isReasoning: false };
  }

  const openIdx = text.indexOf(OPEN_TAG);
  if (openIdx >= 0) {
    // Mid-reasoning: no closing tag yet, so there is no answer to show.
    return {
      reasoning: text.slice(openIdx + OPEN_TAG.length).trim(),
      answer: "",
      isReasoning: true,
    };
  }

  // No reasoning markup at all: an ordinary model, or an answer-only stream.
  return { reasoning: "", answer: text, isReasoning: false };
}

// Only the tail of the (possibly very long) chain-of-thought, so the bubble
// reads as a single live, moving thought rather than a growing wall of text.
export function peek(reasoning: string, maxLength = 180): string {
  const trimmed = reasoning.trim();
  return trimmed.length <= maxLength ? trimmed : "…" + trimmed.slice(-maxLength);
}

function stripOpenTag(reasoning: string): string {
  const openIdx = reasoning.indexOf(OPEN_TAG);
  return openIdx >= 0 ? reasoning.slice(openIdx + OPEN_TAG.length) : reasoning;
}
