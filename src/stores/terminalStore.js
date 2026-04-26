import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export const useTerminalTabs = create((set, get) => ({
    tabs: [
        {
            id: "tab-1",
            title: "Terminal 1",
            cwd: "~", // This will be resolved to actual home directory
        },
    ],
    activeTabId: "tab-1",
    homeDir: "~",

    addTab: (cwd = "~", title) => {
        const id = uuidv4();
        const tabNumber = get().tabs.length + 1;
        const newTab = {
            id,
            title: title || `Terminal ${tabNumber}`,
            cwd: cwd || "~",
        };
        set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: id,
        }));
        return id;
    },

    removeTab: (id) => {
        set((state) => {
            // Don't remove last tab
            if (state.tabs.length === 1) return state;

            const tabs = state.tabs.filter((t) => t.id !== id);
            const activeTabId = state.activeTabId === id ? tabs[0].id : state.activeTabId;
            return { tabs, activeTabId };
        });
    },

    setActive: (id) => set({ activeTabId: id }),

    setCwd: (tabId, cwd) => {
        set((state) => ({
            tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, cwd } : t)),
        }));
    },

    setHomeDir: (homeDir) => set({ homeDir }),

    // Get terminal info for IPC
    getTerminalInfo: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        return tab || get().tabs[0];
    },
}));
