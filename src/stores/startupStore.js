import { create } from "zustand";

export const useStartupStore = create((set, get) => ({
    items: [],
    loading: false,

    fetch: async () => {
        set({ loading: true });
        try {
            const items = await window.api.getStartup();
            set({ items, loading: false });
        } catch (error) {
            console.error("Failed to fetch startup commands:", error);
            set({ loading: false });
        }
    },

    add: async (item) => {
        try {
            await window.api.addStartup(item);
            await get().fetch();
        } catch (error) {
            console.error("Failed to add startup command:", error);
        }
    },

    update: async (id, item) => {
        try {
            await window.api.updateStartup(id, item);
            await get().fetch();
        } catch (error) {
            console.error("Failed to update startup command:", error);
        }
    },

    remove: async (id) => {
        try {
            await window.api.deleteStartup(id);
            await get().fetch();
        } catch (error) {
            console.error("Failed to delete startup command:", error);
        }
    },

    clearAll: async () => {
        try {
            await window.api.clearStartup();
            await get().fetch();
        } catch (error) {
            console.error("Failed to clear startup commands:", error);
        }
    },

    reorder: async (fromIndex, toIndex) => {
        const items = [...get().items];
        const [movedItem] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, movedItem);

        // Update order_position for all items
        const updatedItems = items.map((item, index) => ({
            ...item,
            order_position: index,
        }));

        set({ items: updatedItems });

        // Persist to database
        try {
            await window.api.reorderStartup(updatedItems.map((item) => item.id));
        } catch (error) {
            console.error("Failed to reorder startup commands:", error);
            await get().fetch(); // Revert on error
        }
    },
}));
