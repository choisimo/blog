import { create } from 'zustand';

export const useDocumentStore = create((set, get) => ({
  // 상태
  currentDocument: null,
  parsedContent: null,
  generatedPosts: [],
  isProcessing: false,
  error: null,

  // 설정
  settings: {
    targetPosts: 5,
    language: 'ko',
    narrativeStyle: 'experience',
    seriesTitle: '',
    authorName: 'nodove',
  },

  // 액션
  setDocument: document => set({ currentDocument: document }),

  setParsedContent: content => set({ parsedContent: content }),

  setGeneratedPosts: posts => set({ generatedPosts: posts }),

  setProcessing: isProcessing => set({ isProcessing }),

  setError: error => set({ error }),

  updateSettings: newSettings =>
    set(state => ({
      settings: { ...state.settings, ...newSettings },
    })),

  clearAll: () =>
    set({
      currentDocument: null,
      parsedContent: null,
      generatedPosts: [],
      isProcessing: false,
      error: null,
    }),

  // 편의 메서드
  hasDocument: () => get().currentDocument !== null,
  hasParsedContent: () => get().parsedContent !== null,
  hasGeneratedPosts: () => get().generatedPosts.length > 0,

  updatePost: (index, updates) =>
    set(state => {
      const newPosts = [...state.generatedPosts];
      newPosts[index] = { ...newPosts[index], ...updates };
      return { generatedPosts: newPosts };
    }),

  deletePost: index =>
    set(state => ({
      generatedPosts: state.generatedPosts.filter((_, i) => i !== index),
    })),
}));
