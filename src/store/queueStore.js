import { create } from "zustand";

export const useQueueStore = create((set, get) => ({
    queue: [],
    running: false,

    loadQueue: async () => {
        const queue = await window.api.queue.list();
        set({ queue });
        return queue;
    },

    saveQueueItem: async (payload, id = null) => {
        if (id) {
            await window.api.queue.update(id, payload);
        } else {
            await window.api.queue.create(payload);
        }

        return get().loadQueue();
    },

    deleteQueueItem: async (id) => {
        await window.api.queue.delete(id);
        return get().loadQueue();
    },

    clear: async () => {
        await window.api.queue.clear();
        set({ queue: [] });
    },

    runQueue: async () => {
        if (get().running) {
            return;
        }

        set({ running: true });

        try {
            await window.api.queue.run();
        } finally {
            set({ running: false });
            await get().loadQueue();
        }
    },
}));
