import { create } from "zustand";

export const useCommandsStore = create((set, get) => ({
    managedCommands: [],
    groups: ["All Commands", "Gromacs", "Favourite"],
    loading: false,
    selectedGroup: "All Commands",
    searchTerm: "",
    error: null,

    fetch: async () => {
        set({ loading: true, error: null });
        try {
            const commands = await window.api.getCommands(get().selectedGroup);
            set({ managedCommands: commands, loading: false });
        } catch (error) {
            console.error("Failed to fetch commands:", error);
            set({ error: error.message, loading: false });
        }
    },

    fetchGroups: async () => {
        try {
            const groups = await window.api.getCommandGroups();
            set({ groups: ["All Commands", ...groups] });
        } catch (error) {
            console.error("Failed to fetch groups:", error);
        }
    },

    setSelectedGroup: (group) => {
        set({ selectedGroup: group });
        get().fetch();
    },

    setSearchTerm: (term) => {
        set({ searchTerm: term });
        if (term.trim()) {
            get().search(term);
        } else {
            get().fetch();
        }
    },

    search: async (term) => {
        set({ loading: true });
        try {
            const commands = await window.api.searchCommands(term);
            set({ managedCommands: commands, loading: false });
        } catch (error) {
            console.error("Failed to search commands:", error);
            set({ error: error.message, loading: false });
        }
    },

    saveCommand: async (commandData) => {
        try {
            const result = await window.api.saveCommand(commandData);
            await get().fetch();
            await get().fetchGroups();
            return result;
        } catch (error) {
            console.error("Failed to save command:", error);
            set({ error: error.message });
            throw error;
        }
    },

    updateCommand: async (id, commandData) => {
        try {
            await window.api.updateCommand(id, commandData);
            await get().fetch();
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to update command:", error);
            set({ error: error.message });
            throw error;
        }
    },

    deleteCommand: async (id) => {
        try {
            await window.api.deleteCommand(id);
            await get().fetch();
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to delete command:", error);
            set({ error: error.message });
            throw error;
        }
    },

    duplicateCommand: async (id) => {
        try {
            await window.api.duplicateCommand(id);
            await get().fetch();
        } catch (error) {
            console.error("Failed to duplicate command:", error);
            set({ error: error.message });
        }
    },

    addGroup: async (groupName) => {
        try {
            await window.api.addCommandGroup(groupName);
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to add group:", error);
            set({ error: error.message });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
