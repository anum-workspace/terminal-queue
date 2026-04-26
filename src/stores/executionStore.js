import { create } from "zustand";

export const useExecutionStore = create((set, get) => ({
    isExecuting: false,
    currentItem: null,
    progress: {
        total: 0,
        completed: 0,
        failed: 0,
    },

    startExecution: (total) => {
        set({
            isExecuting: true,
            progress: { total, completed: 0, failed: 0 },
        });
    },

    setCurrentItem: (item) => {
        set({ currentItem: item });
    },

    itemCompleted: () => {
        set((state) => ({
            progress: {
                ...state.progress,
                completed: state.progress.completed + 1,
            },
        }));
    },

    itemFailed: () => {
        set((state) => ({
            progress: {
                ...state.progress,
                failed: state.progress.failed + 1,
            },
        }));
    },

    finishExecution: () => {
        set({
            isExecuting: false,
            currentItem: null,
        });
    },

    stopExecution: () => {
        set({
            isExecuting: false,
            currentItem: null,
        });
    },
}));
