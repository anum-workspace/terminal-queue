import { create } from "zustand";

export const useQueueStore = create((set, get) => ({
    items: [],
    loading: false,
    error: null,
    stats: {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        stopped: 0,
    },

    // Fetch all queue items
    fetch: async () => {
        set({ loading: true, error: null });
        try {
            const items = await window.api.getQueue();
            set({ items, loading: false });
            await get().fetchStats();
        } catch (error) {
            console.error("Failed to fetch queue:", error);
            set({ error: error.message, loading: false });
        }
    },

    // Fetch queue statistics
    fetchStats: async () => {
        try {
            const stats = await window.api.getQueueStats();
            set({ stats });
        } catch (error) {
            console.error("Failed to fetch queue stats:", error);
        }
    },

    // Add new item to queue
    add: async (item) => {
        set({ loading: true, error: null });
        try {
            const newItem = await window.api.addQueue(item);
            await get().fetch();
            return newItem;
        } catch (error) {
            console.error("Failed to add queue item:", error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // Update existing queue item
    update: async (id, updates) => {
        set({ loading: true, error: null });
        try {
            await window.api.updateQueue(id, updates);
            await get().fetch();
        } catch (error) {
            console.error("Failed to update queue item:", error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // Remove item from queue
    remove: async (id) => {
        set({ loading: true, error: null });
        try {
            await window.api.deleteQueue(id);
            await get().fetch();
        } catch (error) {
            console.error("Failed to remove queue item:", error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // Clear entire queue
    clearAll: async () => {
        set({ loading: true, error: null });
        try {
            await window.api.clearQueue();
            set({ items: [], loading: false });
            await get().fetchStats();
        } catch (error) {
            console.error("Failed to clear queue:", error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    // Reorder queue items (after drag and drop)
    reorder: async (fromIndex, toIndex) => {
        const items = [...get().items];
        const [movedItem] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, movedItem);

        // Update order_position for all items
        const updatedItems = items.map((item, index) => ({
            ...item,
            order_position: index,
        }));

        // Optimistically update UI
        set({ items: updatedItems });

        // Persist to database
        try {
            const orderedIds = items.map((item) => item.id);
            await window.api.reorderQueue(orderedIds);
        } catch (error) {
            console.error("Failed to reorder queue:", error);
            set({ error: error.message });
            // Revert on error by refetching
            await get().fetch();
        }
    },

    // Move item up or down
    moveItem: async (id, direction) => {
        try {
            await window.api.moveQueueItem(id, direction);
            await get().fetch();
        } catch (error) {
            console.error("Failed to move queue item:", error);
            set({ error: error.message });
        }
    },

    // Update item status
    updateStatus: async (id, status) => {
        try {
            await window.api.updateQueueStatus(id, status);
            // Optimistically update
            set((state) => ({
                items: state.items.map((item) => (item.id === id ? { ...item, status } : item)),
            }));
            await get().fetchStats();
        } catch (error) {
            console.error("Failed to update status:", error);
            set({ error: error.message });
        }
    },

    // Duplicate queue item
    duplicate: async (id) => {
        try {
            await window.api.duplicateQueueItem(id);
            await get().fetch();
        } catch (error) {
            console.error("Failed to duplicate queue item:", error);
            set({ error: error.message });
        }
    },

    // Set all items to running status (when queue execution starts)
    startExecution: async () => {
        const { items } = get();
        const pendingItems = items.filter((item) => item.status === "pending");

        set((state) => ({
            items: state.items.map((item) =>
                item.status === "pending" ? { ...item, status: "queued" } : item,
            ),
        }));

        return pendingItems;
    },

    // Mark item as running
    setRunning: (id) => {
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, status: "running" } : item,
            ),
        }));
    },

    // Mark item as completed
    setCompleted: (id) => {
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, status: "completed" } : item,
            ),
        }));
    },

    // Mark item as failed
    setFailed: (id, error) => {
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, status: "failed", error } : item,
            ),
        }));
    },

    // Mark item as stopped
    setStopped: (id) => {
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, status: "stopped" } : item,
            ),
        }));
    },

    // Clear error
    clearError: () => set({ error: null }),

    // Get item by ID
    getItemById: (id) => {
        return get().items.find((item) => item.id === id);
    },

    // Get pending items count
    getPendingCount: () => {
        return get().items.filter((item) => item.status === "pending").length;
    },

    // Get running items count
    getRunningCount: () => {
        return get().items.filter((item) => item.status === "running").length;
    },
}));
