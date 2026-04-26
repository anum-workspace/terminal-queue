import { useEffect, useState, useCallback } from "react";
import { useCommandsStore } from "../stores/commandsStore";
import {
    VscEdit,
    VscTrash,
    VscSave,
    VscDiscard,
    VscAdd,
    VscChevronDown,
    VscChevronRight,
    VscSearch,
    VscCopy,
    VscTag,
    VscSymbolKeyword,
    VscTerminal,
} from "react-icons/vsc";

export default function Manager() {
    const {
        managedCommands,
        groups,
        selectedGroup,
        loading,
        error,
        searchTerm,
        fetch,
        fetchGroups,
        setSelectedGroup,
        setSearchTerm,
        saveCommand,
        updateCommand,
        deleteCommand,
        duplicateCommand,
        addGroup,
        clearError,
    } = useCommandsStore();

    const [editingId, setEditingId] = useState(null);
    const [isNewCommand, setIsNewCommand] = useState(false);
    const [expandedEditor, setExpandedEditor] = useState(false);
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [expandedCards, setExpandedCards] = useState(new Set());

    const [formData, setFormData] = useState({
        title: "",
        group: "",
        header: "",
        command: "",
        footer: "",
    });

    useEffect(() => {
        fetch();
        fetchGroups();
    }, []);

    const resetForm = useCallback(() => {
        setFormData({
            title: "",
            group: selectedGroup !== "All Commands" ? selectedGroup : "",
            header: "",
            command: "",
            footer: "",
        });
        setEditingId(null);
        setIsNewCommand(false);
        setExpandedEditor(false);
    }, [selectedGroup]);

    const handleEdit = (command) => {
        setEditingId(command.id);
        setIsNewCommand(false);
        setExpandedEditor(true);
        setFormData({
            title: command.title || "",
            group: command.group_name,
            header: command.header || "",
            command: command.command,
            footer: command.footer || "",
        });
    };

    const handleNew = () => {
        resetForm();
        setIsNewCommand(true);
        setExpandedEditor(true);
        setFormData((prev) => ({
            ...prev,
            group: selectedGroup !== "All Commands" ? selectedGroup : "",
        }));
    };

    const handleSave = async () => {
        if (!formData.command.trim()) return;

        // Generate title from command if empty
        const title = formData.title.trim() || generateTitleFromCommand(formData.command);

        const data = {
            title,
            group_name: formData.group || "All Commands",
            header: formData.header,
            command: formData.command,
            footer: formData.footer,
        };

        try {
            if (isNewCommand) {
                await saveCommand(data);
            } else {
                await updateCommand(editingId, data);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to save command:", error);
        }
    };

    const handleDelete = async (id) => {
        if (confirm("Are you sure you want to delete this command?")) {
            await deleteCommand(id);
        }
    };

    const handleDuplicate = async (id) => {
        await duplicateCommand(id);
    };

    const handleAddGroup = async () => {
        if (newGroupName.trim()) {
            try {
                await addGroup(newGroupName.trim());
                setNewGroupName("");
                setShowAddGroup(false);
            } catch (error) {
                console.error("Failed to add group:", error);
            }
        }
    };

    const toggleExpandCard = (id) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedCards(newExpanded);
    };

    // Generate title from command helper
    const generateTitleFromCommand = (command) => {
        if (!command) return "Untitled";
        let title = command.trim().split("\n")[0];
        title = title.replace(/^(sudo|echo|printf)\s+/i, "");
        return title.length > 40 ? title.substring(0, 37) + "..." : title;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header with Group Filter and Search */}
            <div className="flex flex-col gap-2 p-2 border-b border-gray-700/50 bg-gray-800/50">
                <div className="flex items-center gap-2">
                    {/* Group Filter */}
                    <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none flex-1"
                    >
                        {groups.map((group) => (
                            <option key={group} value={group}>
                                {group}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => setShowAddGroup(!showAddGroup)}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition text-gray-200 flex items-center gap-1"
                    >
                        <VscAdd size={12} />
                        New Group
                    </button>
                </div>

                {/* Add Group Input */}
                {showAddGroup && (
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group name"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200"
                            onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                            autoFocus
                        />
                        <button
                            onClick={handleAddGroup}
                            className="text-xs px-2 py-0.5 bg-green-700 hover:bg-green-600 rounded text-gray-200"
                        >
                            Add
                        </button>
                        <button
                            onClick={() => setShowAddGroup(false)}
                            className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Search Bar */}
                <div className="relative">
                    <VscSearch
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
                        size={14}
                    />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search commands..."
                        className="w-full bg-gray-700 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50"
                    />
                </div>
            </div>

            {/* Command Editor */}
            {expandedEditor && (
                <div className="border-b border-gray-700/50 bg-gray-800/30 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                            <VscTerminal size={16} />
                            {isNewCommand ? "New Command" : "Edit Command"}
                        </h3>
                        <button
                            onClick={() => setExpandedEditor(false)}
                            className="text-gray-400 hover:text-gray-200 transition"
                        >
                            <VscChevronDown size={16} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {/* Title Field */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                <VscTag size={12} />
                                Title
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                placeholder="e.g., GROMACS MD Simulation"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                            />
                            {!formData.title && formData.command && (
                                <div className="text-xs text-gray-600 mt-0.5">
                                    Auto-generated: {generateTitleFromCommand(formData.command)}
                                </div>
                            )}
                        </div>

                        {/* Group */}
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Group</label>
                            <select
                                value={formData.group}
                                onChange={(e) =>
                                    setFormData({ ...formData, group: e.target.value })
                                }
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none"
                            >
                                <option value="">Select group</option>
                                {groups.map((group) => (
                                    <option key={group} value={group}>
                                        {group}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Header */}
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">
                                Header (optional)
                            </label>
                            <textarea
                                value={formData.header}
                                onChange={(e) =>
                                    setFormData({ ...formData, header: e.target.value })
                                }
                                rows={2}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                                placeholder="source /usr/local/gromacs/bin/GMXRC"
                            />
                        </div>

                        {/* Command */}
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">
                                <span className="text-red-400">*</span> Command
                            </label>
                            <textarea
                                value={formData.command}
                                onChange={(e) =>
                                    setFormData({ ...formData, command: e.target.value })
                                }
                                rows={3}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                                placeholder="gmx mdrun -deffnm npt"
                            />
                        </div>

                        {/* Footer */}
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">
                                Footer (optional)
                            </label>
                            <textarea
                                value={formData.footer}
                                onChange={(e) =>
                                    setFormData({ ...formData, footer: e.target.value })
                                }
                                rows={2}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                                placeholder="echo 'Simulation complete'"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={!formData.command.trim()}
                            className="flex items-center gap-1 px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-gray-200 transition"
                        >
                            <VscSave size={14} />
                            Save
                        </button>
                        <button
                            onClick={resetForm}
                            className="flex items-center gap-1 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
                        >
                            <VscDiscard size={14} />
                            Discard
                        </button>
                    </div>
                </div>
            )}

            {/* Add New Button */}
            {!expandedEditor && (
                <button
                    onClick={handleNew}
                    className="m-2 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-750 border border-gray-600/50 rounded-lg text-sm text-gray-300 hover:text-gray-200 transition"
                >
                    <VscAdd size={16} />
                    <span>Add New Command</span>
                </button>
            )}

            {/* Saved Commands List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading && (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        <div className="animate-spin mr-2">
                            <VscSymbolKeyword size={16} />
                        </div>
                        Loading...
                    </div>
                )}

                {!loading && managedCommands.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        {searchTerm
                            ? `No commands matching "${searchTerm}"`
                            : selectedGroup === "All Commands"
                              ? "No commands saved yet"
                              : `No commands in ${selectedGroup}`}
                    </div>
                )}

                {managedCommands.map((cmd) => (
                    <div
                        key={cmd.id}
                        className={`bg-gray-800/50 border border-gray-700/50 rounded-lg transition-all ${
                            editingId === cmd.id
                                ? "ring-1 ring-blue-500/50"
                                : "hover:border-gray-600/50"
                        }`}
                    >
                        {/* Command Card Header */}
                        <div className="flex items-start gap-3 p-3">
                            {/* Expand/Collapse */}
                            <button
                                onClick={() => toggleExpandCard(cmd.id)}
                                className="text-gray-500 hover:text-gray-300 mt-0.5 transition"
                            >
                                {expandedCards.has(cmd.id) ? (
                                    <VscChevronDown size={14} />
                                ) : (
                                    <VscChevronRight size={14} />
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                {/* Title and Group */}
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-medium text-gray-200 truncate">
                                        {cmd.title || "Untitled Command"}
                                    </h4>
                                    <span className="text-xs px-2 py-0.5 bg-gray-700/50 rounded text-gray-400">
                                        {cmd.group_name}
                                    </span>
                                </div>

                                {/* Command Preview */}
                                <div
                                    className={`font-mono text-xs text-gray-400 ${expandedCards.has(cmd.id) ? "" : "truncate"}`}
                                >
                                    {cmd.command}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDuplicate(cmd.id)}
                                    className="p-1.5 hover:bg-gray-700/60 rounded transition text-gray-400 hover:text-blue-400"
                                    title="Duplicate"
                                >
                                    <VscCopy size={14} />
                                </button>
                                <button
                                    onClick={() => handleEdit(cmd)}
                                    className="p-1.5 hover:bg-gray-700/60 rounded transition text-gray-400 hover:text-yellow-400"
                                    title="Edit"
                                >
                                    <VscEdit size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(cmd.id)}
                                    className="p-1.5 hover:bg-gray-700/60 rounded transition text-gray-400 hover:text-red-400"
                                    title="Delete"
                                >
                                    <VscTrash size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedCards.has(cmd.id) && (
                            <div className="px-3 pb-3 space-y-2 border-t border-gray-700/30 pt-2">
                                {cmd.header && (
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">
                                            Header:
                                        </label>
                                        <div className="bg-gray-900/50 rounded p-2 font-mono text-xs text-gray-300">
                                            {cmd.header}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs text-gray-500 font-medium mb-1 block">
                                        Command:
                                    </label>
                                    <div className="bg-gray-900/50 rounded p-2 font-mono text-xs text-gray-200">
                                        {cmd.command}
                                    </div>
                                </div>

                                {cmd.footer && (
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">
                                            Footer:
                                        </label>
                                        <div className="bg-gray-900/50 rounded p-2 font-mono text-xs text-gray-300">
                                            {cmd.footer}
                                        </div>
                                    </div>
                                )}

                                <div className="text-xs text-gray-600 pt-1">
                                    Created: {new Date(cmd.timestamp).toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Error Toast */}
            {error && (
                <div className="absolute bottom-4 right-4 bg-red-900/90 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-200 flex items-center gap-2">
                    <span>{error}</span>
                    <button onClick={clearError} className="text-red-400 hover:text-red-300">
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
