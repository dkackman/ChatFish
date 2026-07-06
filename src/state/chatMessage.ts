// Modifier value for the transient "the model is thinking" bubble. It carries
// no text of its own; MessageBubble renders an animated indicator instead.
export const THINKING_MODIFIER = "thinking";

export interface ChatMessage {
  message: string;
  modifier: string;
  // A live peek at a reasoning model's chain-of-thought, shown under the
  // thinking indicator. Only meaningful while isThinking.
  reasoning: string;
}

export const COMMANDS: Readonly<Record<string, string>> = {
  about: "Show the about page",
  help: "Display this help",
  llm: "Configure the LLM",
};

export const EMOTES: Readonly<Record<string, string>> = {
  shout: "Shout a chat message",
  whisper: "Whisper a chat message",
};

export function emptyMessage(): ChatMessage {
  return { message: "", modifier: "", reasoning: "" };
}

export function fromMessage(text: string): ChatMessage {
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    // "/command argument..." — everything after the first space is the message
    const spaceIdx = trimmed.indexOf(" ");
    const modifier = (spaceIdx < 0 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
    const message = spaceIdx < 0 ? "" : trimmed.slice(spaceIdx + 1);
    return { message, modifier, reasoning: "" };
  }
  return { message: trimmed, modifier: "", reasoning: "" };
}

// Wraps raw model output as a plain reply. Unlike fromMessage it does no
// command/emote parsing, so a reply that happens to start with '/' is shown
// verbatim rather than being misread as a command.
export function fromReply(reply: string): ChatMessage {
  return { message: reply, modifier: "", reasoning: "" };
}

// A "thinking" bubble shown while awaiting the model's answer. The optional
// reasoning is streamed underneath the animated indicator.
export function thinking(reasoning = ""): ChatMessage {
  return { message: "", modifier: THINKING_MODIFIER, reasoning };
}

export function isCommand(m: ChatMessage): boolean {
  return Object.hasOwn(COMMANDS, m.modifier);
}

export function isThinking(m: ChatMessage): boolean {
  return m.modifier === THINKING_MODIFIER;
}

export function isEmpty(m: ChatMessage): boolean {
  return m.message.trim() === "" && m.modifier.trim() === "";
}

export function messagesEqual(a: ChatMessage, b: ChatMessage): boolean {
  return a.message === b.message && a.modifier === b.modifier && a.reasoning === b.reasoning;
}
