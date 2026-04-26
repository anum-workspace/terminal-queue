import { create } from "zustand";

export const useCommandsStore = create((set, get) => ({
    managedCommands: [],
    groups: ["All Commands", "Gromacs", "Favourite"],
    loading: false,
    selectedGroup: "All Commands",

    fetch: async () => {
        set({ loading: true });
        try {
            const commands = await window.api.getCommands(get().selectedGroup);
            set({ managedCommands: commands, loading: false });
        } catch (error) {
            console.error("Failed to fetch commands:", error);
            set({ loading: false });
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

    saveCommand: async (commandData) => {
        try {
            await window.api.saveCommand(commandData);
            await get().fetch();
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to save command:", error);
        }
    },

    updateCommand: async (id, commandData) => {
        try {
            await window.api.updateCommand(id, commandData);
            await get().fetch();
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to update command:", error);
        }
    },

    deleteCommand: async (id) => {
        try {
            await window.api.deleteCommand(id);
            await get().fetch();
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to delete command:", error);
        }
    },

    addGroup: async (groupName) => {
        try {
            await window.api.addCommandGroup(groupName);
            await get().fetchGroups();
        } catch (error) {
            console.error("Failed to add group:", error);
        }
    },
}));
