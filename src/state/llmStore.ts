import { create } from "zustand";
import * as llm from "../llm/engine";
import { fromReply } from "./chatMessage";
import { AI_FISH_ID, useFishStore } from "./fishStore";

export const SELECTED_MODEL_STORAGE_KEY = "selectedModel";

interface LlmState {
  availableModels: string[];
  downloadedModels: string[];
  selectedModel: string;
  loadedModel: string | null;
  progressText: string;
  progressValue: number; // 0..1
  isProgressVisible: boolean;
  initialize(): Promise<void>;
  selectModel(modelId: string): void;
  loadEngine(): Promise<void>;
}

export const useLlmStore = create<LlmState>((set, get) => ({
  availableModels: [llm.DEFAULT_MODEL],
  downloadedModels: [],
  selectedModel: llm.DEFAULT_MODEL,
  loadedModel: null,
  progressText: "",
  progressValue: 0,
  isProgressVisible: false,

  async initialize() {
    try {
      set({ availableModels: llm.getAvailableModels() });
      set({ downloadedModels: await llm.getDownloadedModels() });
    } catch (error) {
      console.warn("Failed to query models; using default.", error);
    }
    // localStorage returns null on first visit; only restore a previously
    // saved model so an invalid value is never selected.
    const saved = localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
    if (saved) {
      get().selectModel(saved);
    }
  },

  selectModel(modelId) {
    if (modelId && get().availableModels.includes(modelId)) {
      localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
      set({ selectedModel: modelId });
    } else {
      console.warn(`Invalid model selected: ${modelId}`);
    }
  },

  async loadEngine() {
    llm.resetEngine();
    set({
      loadedModel: null,
      isProgressVisible: true,
      progressText: "Initializing WebLLM engine...",
      progressValue: 0,
    });

    const onProgress = (text: string, progress: number) => set({ progressText: text, progressValue: progress });
    // Init/download failures show in the dialog status AND the AI fish bubble,
    // matching the Blazor app's MessageError fan-out.
    const onError = (message: string) => {
      set({ progressText: message, progressValue: 0 });
      useFishStore.getState().setFishMessage(AI_FISH_ID, fromReply(message));
    };

    const loaded = await llm.initializeEngine(get().selectedModel, onProgress, onError);
    // The model is now cached; refresh so the dropdown shows its marker.
    set({ loadedModel: loaded, downloadedModels: await llm.getDownloadedModels() });
  },
}));
