import { describe, expect, it } from "vitest";
import { fromMessage, isCommand, isEmpty, messagesEqual } from "./chatMessage";

describe("fromMessage", () => {
  it("plain text has no modifier", () => {
    const m = fromMessage("hello there");
    expect(m.message).toBe("hello there");
    expect(m.modifier).toBe("");
    expect(isCommand(m)).toBe(false);
    expect(isEmpty(m)).toBe(false);
  });

  it("plain text is trimmed", () => {
    expect(fromMessage("   spaced   ").message).toBe("spaced");
  });

  it("command with argument splits modifier and message", () => {
    const m = fromMessage("/shout hello world");
    expect(m.modifier).toBe("shout");
    expect(m.message).toBe("hello world");
  });

  it("command without argument has empty message", () => {
    const m = fromMessage("/help");
    expect(m.modifier).toBe("help");
    expect(m.message).toBe("");
  });

  it("modifier is lowercased", () => {
    expect(fromMessage("/HELP").modifier).toBe("help");
  });

  it.each(["about", "help", "llm"])("isCommand is true for /%s", (command) => {
    expect(isCommand(fromMessage(`/${command}`))).toBe(true);
  });

  it.each(["shout", "whisper"])("emote /%s is not a command", (emote) => {
    const m = fromMessage(`/${emote} hi`);
    expect(isCommand(m)).toBe(false);
    expect(m.modifier).toBe(emote);
  });

  it.each(["", "   ", "/"])("isEmpty is true for %j", (input) => {
    expect(isEmpty(fromMessage(input))).toBe(true);
  });

  it("equality matches on message and modifier", () => {
    const a = fromMessage("/shout hi");
    const b = fromMessage("/shout hi");
    const c = fromMessage("/whisper hi");
    expect(messagesEqual(a, b)).toBe(true);
    expect(messagesEqual(a, c)).toBe(false);
  });
});
