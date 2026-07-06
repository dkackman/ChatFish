import { useEffect, useRef, useState } from "react";
import { dispatchMessage } from "../state/dispatcher";
import { useFishStore } from "../state/fishStore";
import "../styles/chatInput.css";

export function ChatInput() {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isGenerating = useFishStore((s) => s.isGenerating);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || isGenerating) {
      return;
    }
    // Clear the input up front so it empties as the user's fish bubble appears,
    // not after the model finishes responding (the dispatch awaits generation).
    const message = text;
    setText("");
    void dispatchMessage(message);
  }

  return (
    <form onSubmit={onSubmit} className="chat-input-container" aria-label="Chat message input">
      <input
        id="chat-message"
        ref={inputRef}
        type="text"
        className="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={45}
        placeholder="Type a short message... (/help for more)"
        aria-label="Chat message input"
        disabled={isGenerating}
      />
      <button type="submit" className="chat-submit" disabled={!text.trim() || isGenerating} aria-label="Send message">
        Send
      </button>
    </form>
  );
}
