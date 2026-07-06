import { sendChatMessage } from "../llm/engine";
import { COMMANDS, EMOTES, fromMessage, fromReply, isCommand, isEmpty, thinking, type ChatMessage } from "./chatMessage";
import { AI_FISH_ID, USER_FISH_ID, useFishStore } from "./fishStore";
import { parseReasoning, peek } from "./reasoningParser";

export const ABOUT_URL = "https://github.com/dkackman/ChatFish";
export const EMPTY_REPLY_FALLBACK = "🫧 (I didn't have anything to say — try again?)";
export const NO_MODEL_MESSAGE = "Make sure to select and download a model first.";

export async function dispatchMessage(text: string): Promise<void> {
  const message = fromMessage(text);
  if (isEmpty(message)) {
    return;
  }
  if (isCommand(message)) {
    processCommand(message.modifier);
    return;
  }
  await sendToFish(message);
}

function processCommand(command: string): void {
  const store = useFishStore.getState();
  switch (command) {
    case "help":
      store.showToast({
        title: "Help",
        caption: "Available commands",
        messages: [
          ...Object.entries(COMMANDS).map(([name, description]) => `/${name} - ${description}`),
          ...Object.entries(EMOTES).map(([name, description]) => `/${name} - ${description}`),
        ],
      });
      break;
    case "about":
      window.open(ABOUT_URL, "_blank");
      break;
    case "llm":
      store.openSettings();
      break;
  }
}

async function sendToFish(message: ChatMessage): Promise<void> {
  const { setFishMessage, isGenerating, setGenerating } = useFishStore.getState();
  // A reply is already streaming: ignore this send rather than racing a second
  // generate() call against the first on the shared engine/transcript.
  if (isGenerating) {
    return;
  }

  setGenerating(true);
  setFishMessage(USER_FISH_ID, message);
  // Show the animated "thinking" bubble immediately; it stays until the
  // first streamed token replaces it (or an error clears it).
  setFishMessage(AI_FISH_ID, thinking());

  try {
    await sendChatMessage(message.message, {
      // Partial reply streamed token-by-token. Reasoning models stream a
      // <think>...</think> chain-of-thought before the answer; while that is
      // still arriving we keep the thinking bubble and let its peek follow the
      // live reasoning, only switching once real answer text appears.
      onUpdate(partial) {
        const parsed = parseReasoning(partial);
        if (parsed.isReasoning) {
          setFishMessage(AI_FISH_ID, thinking(peek(parsed.reasoning)));
        } else if (parsed.answer.trim()) {
          setFishMessage(AI_FISH_ID, fromReply(parsed.answer));
        }
        // else: answer hasn't started yet (e.g. just past </think>) — leave the
        // thinking bubble in place rather than flashing it blank.
      },
      // Final reply. Show only the answer (reasoning was transient), with a
      // fallback so an empty turn doesn't silently vanish.
      onFinish(final) {
        const answer = parseReasoning(final).answer;
        setFishMessage(AI_FISH_ID, fromReply(answer.trim() ? answer : EMPTY_REPLY_FALLBACK));
      },
      onError(error) {
        setFishMessage(AI_FISH_ID, fromReply(error));
      },
    });
  } catch {
    setFishMessage(AI_FISH_ID, fromReply(NO_MODEL_MESSAGE));
  } finally {
    setGenerating(false);
  }
}
