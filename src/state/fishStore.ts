import { create } from "zustand";
import { emptyMessage, isEmpty, messagesEqual, type ChatMessage } from "./chatMessage";

export type FishColor = "Blue" | "Green" | "Orange" | "Pink" | "Yellow" | "Red";

export interface FishData {
  id: string;
  color: FishColor;
  scale: string;
  message: ChatMessage;
  isMessageVisible: boolean;
}

export interface Toast {
  title: string;
  caption: string;
  messages?: string[];
}

export const AI_FISH_ID = "ai";
export const USER_FISH_ID = "user";
export const MESSAGE_VISIBILITY_MS = 25000;

interface FishTankState {
  fish: Record<string, FishData>;
  toast: Toast | null;
  isSettingsVisible: boolean;
  isOffline: boolean;
  setFishMessage(id: string, message: ChatMessage): void;
  showToast(toast: Toast): void;
  closeToast(): void;
  openSettings(): void;
  closeSettings(): void;
  setOffline(offline: boolean): void;
}

// Bubble auto-hide timers, one per fish; not reactive state.
const hideTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useFishStore = create<FishTankState>((set, get) => ({
  fish: {
    [AI_FISH_ID]: { id: AI_FISH_ID, color: "Orange", scale: "1.0", message: emptyMessage(), isMessageVisible: false },
    [USER_FISH_ID]: { id: USER_FISH_ID, color: "Blue", scale: "0.9", message: emptyMessage(), isMessageVisible: false },
  },
  toast: null,
  // The settings dialog is visible on startup, matching the Blazor app.
  isSettingsVisible: true,
  isOffline: false,

  setFishMessage(id, message) {
    const current = get().fish[id];
    // Ignore unknown fish and equal values so subscribers aren't churned needlessly.
    if (!current || messagesEqual(current.message, message)) {
      return;
    }

    const visible = !isEmpty(message);
    clearTimeout(hideTimers.get(id));
    if (visible) {
      hideTimers.set(
        id,
        setTimeout(() => {
          set((s) => ({ fish: { ...s.fish, [id]: { ...s.fish[id], isMessageVisible: false } } }));
        }, MESSAGE_VISIBILITY_MS),
      );
    }

    set((s) => ({ fish: { ...s.fish, [id]: { ...s.fish[id], message, isMessageVisible: visible } } }));
  },

  showToast(toast) {
    set({ toast });
  },
  closeToast() {
    set({ toast: null });
  },
  openSettings() {
    set({ isSettingsVisible: true });
  },
  closeSettings() {
    set({ isSettingsVisible: false });
  },
  setOffline(offline) {
    set({ isOffline: offline });
  },
}));
