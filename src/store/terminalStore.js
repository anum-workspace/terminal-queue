import { create } from "zustand";

function createTab(session) {
    return {
        id: session.sessionId,
        sessionId: session.sessionId,
        name: session.name,
        cwd: session.cwd,
        persistent: Boolean(session.persistent),
        autoClose: Boolean(session.autoClose),
        buffer: "",
    };
}

export const useTerminalStore = create((set, get) => ({
    tabs: [],
    active: null,
    defaultSessionId: null,
    initialized: false,

    initialize: async () => {
        if (get().initialized) {
            return;
        }

        const home = await window.api.system.home();
        const session = await window.api.terminal.create({
            cwd: home,
            name: "Home",
            persistent: true,
            autoClose: false,
        });

        set({
            tabs: [createTab(session)],
            active: session.sessionId,
            defaultSessionId: session.sessionId,
            initialized: true,
        });
    },

    recreateDefault: async () => {
        const home = await window.api.system.home();
        const session = await window.api.terminal.create({
            cwd: home,
            name: "Home",
            persistent: true,
            autoClose: false,
        });

        set((state) => {
            const tabs = state.tabs.filter(
                (tab) =>
                    tab.sessionId !== state.defaultSessionId && tab.sessionId !== session.sessionId,
            );
            return {
                tabs: [createTab(session), ...tabs],
                active: session.sessionId,
                defaultSessionId: session.sessionId,
                initialized: true,
            };
        });
    },

    registerSession: (session) =>
        set((state) => {
            if (state.tabs.some((tab) => tab.sessionId === session.sessionId)) {
                return {
                    active: session.sessionId,
                };
            }

            return {
                tabs: [...state.tabs, createTab(session)],
                active: session.sessionId,
            };
        }),

    setActive: (id) => set({ active: id }),

    appendOutput: (sessionId, chunk) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.sessionId === sessionId ? { ...tab, buffer: tab.buffer + chunk } : tab,
            ),
        })),

    updateTabMeta: (sessionId, updates) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.sessionId === sessionId ? { ...tab, ...updates } : tab,
            ),
        })),

    closeTab: async (sessionId) => {
        const state = get();
        const tab = state.tabs.find((item) => item.sessionId === sessionId);

        if (!tab || tab.persistent) {
            return;
        }

        await window.api.terminal.close(sessionId);
        get().removeTab(sessionId);
    },

    removeTab: (sessionId) =>
        set((state) => {
            const remainingTabs = state.tabs.filter((tab) => tab.sessionId !== sessionId);
            const nextActive =
                state.active === sessionId
                    ? remainingTabs[0]?.sessionId || state.defaultSessionId
                    : state.active;

            return {
                tabs: remainingTabs,
                active: nextActive,
            };
        }),

    revealInDefault: async (cwd, previewText) => {
        const state = get();
        if (!state.defaultSessionId) {
            return;
        }

        await window.api.terminal.revealDirectory(state.defaultSessionId, cwd, previewText);
        set({ active: state.defaultSessionId });
        get().updateTabMeta(state.defaultSessionId, { cwd });
    },
}));
