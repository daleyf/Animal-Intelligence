import { create } from "zustand";

interface AppStore {
  activeConversationId: string | null;
  activeModel: string;
  isGenerating: boolean;
  abortController: AbortController | null;
  ollamaConnected: boolean;

  setActiveConversation: (id: string | null) => void;
  setActiveModel: (model: string) => void;
  setGenerating: (generating: boolean, controller?: AbortController) => void;
  stopGeneration: () => void;
  setOllamaConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  activeConversationId: null,
  activeModel: "llama3.1:8b",
  isGenerating: false,
  abortController: null,
  ollamaConnected: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setActiveModel: (model) => set({ activeModel: model }),

  setGenerating: (generating, controller) =>
    set({
      isGenerating: generating,
      abortController: controller ?? (generating ? get().abortController : null),
    }),

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ isGenerating: false, abortController: null });
  },

  setOllamaConnected: (connected) => set({ ollamaConnected: connected }),
}));
