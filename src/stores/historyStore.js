import { create } from "zustand";

export const useHistoryStore = create((set, get) => ({
    items: [],
    loading: false,
    error: null,

    fetch: async () => {
        set({ loading: true, error: null });
        try {
            const items = await window.api.getHistory();
            set({ items, loading: false });
            console.log(`Fetched ${items.length} history items`);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            set({ error: error.message, loading: false });
        }
    },

    listenForUpdates: () => {
        if (window.api.onHistoryUpdated) {
            window.api.onHistoryUpdated(() => {
                console.log("History updated, refreshing...");
                get().fetch();
            });
        }
    },

    deleteHistory: async (ids) => {
        try {
            await window.api.deleteHistory(ids);
            await get().fetch();
        } catch (error) {
            console.error("Failed to delete history:", error);
        }
    },

    deleteSingle: async (id) => {
        await get().deleteHistory([id]);
    },

    retryCommand: async (item) => {
        try {
            await window.api.retryCommand(item);
            // Optionally navigate to queue or show notification
        } catch (error) {
            console.error("Failed to retry command:", error);
        }
    },

    addToGroup: async (historyId, groupName) => {
        try {
            await window.api.addToGroup(historyId, groupName);
        } catch (error) {
            console.error("Failed to add to group:", error);
        }
    },

    setFilter: (status) => {
        set({ filter: status });
    },

    clearFilter: () => {
        set({ filter: null });
    },
}));
