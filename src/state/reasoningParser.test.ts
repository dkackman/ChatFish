import { describe, expect, it } from "vitest";
import { parseReasoning, peek } from "./reasoningParser";

describe("parseReasoning", () => {
  it("plain text is the answer with no reasoning", () => {
    expect(parseReasoning("The answer is 4.")).toEqual({
      reasoning: "",
      answer: "The answer is 4.",
      isReasoning: false,
    });
  });

  it("open think block mid-stream is reasoning with no answer", () => {
    expect(parseReasoning("<think>Okay, the user wants the sum")).toEqual({
      reasoning: "Okay, the user wants the sum",
      answer: "",
      isReasoning: true,
    });
  });

  it("closed think block splits reasoning from answer", () => {
    expect(parseReasoning("<think>2 plus 2 is 4.</think>\n\nThe answer is 4.")).toEqual({
      reasoning: "2 plus 2 is 4.",
      answer: "The answer is 4.",
      isReasoning: false,
    });
  });

  it("closed block without open tag treats leading text as reasoning", () => {
    // Some templates prefill the opening <think>, so only the close streams.
    expect(parseReasoning("reasoning here</think>the answer")).toEqual({
      reasoning: "reasoning here",
      answer: "the answer",
      isReasoning: false,
    });
  });

  it("just-closed think block has no answer yet", () => {
    const result = parseReasoning("<think>done thinking</think>");
    expect(result.isReasoning).toBe(false);
    expect(result.answer).toBe("");
  });
});

describe("peek", () => {
  it("returns the tail of long reasoning", () => {
    const reasoning = "a".repeat(100) + "TAIL";
    expect(peek(reasoning, 10)).toBe("…aaaaaaTAIL");
  });

  it("returns short reasoning whole, trimmed", () => {
    expect(peek("  short thought  ", 180)).toBe("short thought");
  });
});
