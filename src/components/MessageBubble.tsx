import type { BubbleVerticalSide, Direction } from "../engine/geometry";
import { EMOTES, THINKING_MODIFIER, isThinking, type ChatMessage } from "../state/chatMessage";
import "../styles/messageBubble.css";

// Only known modifiers become CSS classes; anything else (e.g. a hostile
// modifier typed as "/<script> hi") is dropped. Replaces the Blazor
// HtmlSanitizer, which sanitized the modifier before class interpolation.
const MODIFIER_CLASS_ALLOWLIST = new Set([...Object.keys(EMOTES), THINKING_MODIFIER]);

interface MessageBubbleProps {
  message: ChatMessage;
  isVisible: boolean;
  fishDirection: Direction;
  verticalSide: BubbleVerticalSide;
}

export function MessageBubble({ message, isVisible, fishDirection, verticalSide }: MessageBubbleProps) {
  const modifierClass = MODIFIER_CLASS_ALLOWLIST.has(message.modifier) ? message.modifier : "";
  return (
    <div
      className={`message-bubble ${isVisible ? "visible" : "hidden"} ${modifierClass} ${fishDirection} ${verticalSide}`}
      role="status"
      aria-live="polite"
    >
      {isThinking(message) ? (
        <>
          <span className="thinking-dots" aria-label="thinking">
            <span></span>
            <span></span>
            <span></span>
          </span>
          {message.reasoning && (
            /* Decorative "watch the fish think" peek; aria-hidden so its rapid
               updates don't flood screen readers. React escapes the text. */
            <div className="thinking-reasoning" aria-hidden="true">
              {message.reasoning}
            </div>
          )}
        </>
      ) : (
        /* React escapes interpolated strings, so untrusted model/user text is
           rendered safely as literal text (including <think> tags or "a < b"). */
        message.message
      )}
    </div>
  );
}
