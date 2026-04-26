import { useEffect, useState } from "react";
import { useStartupStore } from "../stores/startupStore";
import { useCommandsStore } from "../stores/commandsStore";
import {
    VscEdit,
    VscTrash,
    VscPlay,
    VscAdd,
    VscClearAll,
    VscChevronUp,
    VscChevronDown,
    VscGrabber,
} from "react-icons/vsc";

export default function Startup() {
    const { items, fetch, add, update, remove, clearAll, reorder } = useStartupStore();
    const { managedCommands, fetch: fetchCommands } = useCommandsStore();

    const [editingId, setEditingId] = useState(null);
    const [isNewItem, setIsNewItem] = useState(false);
    const [formData, setFormData] = useState({
        dir: "~",
        header: "",
        command: "",
        footer: "",
        delay: 0,
    });

    useEffect(() => {
        fetch();
        fetchCommands();
    }, []);

    const handleEdit = (item) => {
        setEditingId(item.id);
        setIsNewItem(false);
        setFormData({
            dir: item.dir || "~",
            header: item.header || "",
            command: item.command,
            footer: item.footer || "",
            delay: item.delay || 0,
        });
    };

    const handleNew = () => {
        setEditingId(null);
        setIsNewItem(true);
        setFormData({
            dir: "~",
            header: "",
            command: "",
            footer: "",
            delay: 0,
        });
    };

    const handleSave = async () => {
        if (!formData.command.trim()) return;

        const data = {
            dir: formData.dir,
            header: formData.header,
            command: formData.command,
            footer: formData.footer,
            delay: parseInt(formData.delay) || 0,
            order_position: isNewItem ? items.length : undefined,
        };

        if (isNewItem) {
            await add(data);
        } else {
            await update(editingId, data);
        }

        handleDiscard();
    };

    const handleDiscard = () => {
        setEditingId(null);
        setIsNewItem(false);
        setFormData({ dir: "~", header: "", command: "", footer: "", delay: 0 });
    };

    const handleManagedSelect = (e) => {
        const selected = managedCommands.find((c) => c.id == e.target.value);
        if (selected) {
            setFormData({
                ...formData,
                header: selected.header || "",
                command: selected.command,
                footer: selected.footer || "",
            });
        }
    };

    const handleMoveUp = (index) => {
        if (index > 0) {
            reorder(index, index - 1);
        }
    };

    const handleMoveDown = (index) => {
        if (index < items.length - 1) {
            reorder(index, index + 1);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Clear All Button */}
            {items.length > 0 && (
                <div className="p-2 border-b border-gray-700/50 bg-gray-800/50">
                    <button
                        onClick={() => {
                            if (confirm("Clear all startup commands?")) {
                                clearAll();
                            }
                        }}
                        className="flex items-center gap-1 text-xs px-3 py-1 bg-red-700/50 hover:bg-red-600/50 text-red-200 rounded transition"
                    >
                        <VscClearAll size={14} />
                        Clear All Startup Commands
                    </button>
                </div>
            )}

            {/* Saved Startup Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.length === 0 && !isNewItem && (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        No startup commands configured
                    </div>
                )}

                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={`bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600/50 transition ${
                            editingId === item.id ? "ring-1 ring-blue-500/50" : ""
                        }`}
                    >
                        {editingId === item.id ? (
                            // Edit Mode
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-gray-500">
                                        Order: {index + 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                            className="p-0.5 hover:bg-gray-700/50 rounded disabled:opacity-30"
                                        >
                                            <VscChevronUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(index)}
                                            disabled={index === items.length - 1}
                                            className="p-0.5 hover:bg-gray-700/50 rounded disabled:opacity-30"
                                        >
                                            <VscChevronDown size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Directory
                                    </label>
                                    <input
                                        value={formData.dir}
                                        onChange={(e) =>
                                            setFormData({ ...formData, dir: e.target.value })
                                        }
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Header
                                    </label>
                                    <textarea
                                        value={formData.header}
                                        onChange={(e) =>
                                            setFormData({ ...formData, header: e.target.value })
                                        }
                                        rows={2}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Command *
                                    </label>
                                    <textarea
                                        value={formData.command}
                                        onChange={(e) =>
                                            setFormData({ ...formData, command: e.target.value })
                                        }
                                        rows={2}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Footer
                                    </label>
                                    <textarea
                                        value={formData.footer}
                                        onChange={(e) =>
                                            setFormData({ ...formData, footer: e.target.value })
                                        }
                                        rows={2}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Delay (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.delay}
                                        onChange={(e) =>
                                            setFormData({ ...formData, delay: e.target.value })
                                        }
                                        min="0"
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm text-gray-200 transition"
                                    >
                                        <VscPlay size={14} />
                                        Save
                                    </button>
                                    <button
                                        onClick={handleDiscard}
                                        className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
                                    >
                                        Discard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // View Mode
                            <div>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
                                            #{index + 1}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">
                                            {item.dir}
                                        </span>
                                        {item.delay > 0 && (
                                            <span className="text-xs text-yellow-400/70">
                                                ⏱ {item.delay}s delay
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                            className="p-1 hover:bg-gray-700/50 rounded disabled:opacity-30 text-gray-400"
                                        >
                                            <VscChevronUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(index)}
                                            disabled={index === items.length - 1}
                                            className="p-1 hover:bg-gray-700/50 rounded disabled:opacity-30 text-gray-400"
                                        >
                                            <VscChevronDown size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-yellow-400"
                                        >
                                            <VscEdit size={12} />
                                        </button>
                                        <button
                                            onClick={() => remove(item.id)}
                                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-red-400"
                                        >
                                            <VscTrash size={12} />
                                        </button>
                                    </div>
                                </div>

                                {item.header && (
                                    <div className="text-xs text-gray-500 font-mono mb-1 bg-gray-900/50 rounded px-2 py-1">
                                        {item.header}
                                    </div>
                                )}
                                <div className="text-sm text-gray-200 font-mono bg-gray-900/50 rounded px-2 py-1">
                                    {item.command}
                                </div>
                                {item.footer && (
                                    <div className="text-xs text-gray-500 font-mono mt-1 bg-gray-900/50 rounded px-2 py-1">
                                        {item.footer}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add New Button or Editor */}
            <div className="border-t border-gray-700/50 bg-gray-800/50">
                {isNewItem ? (
                    <div className="p-3 space-y-2">
                        <h4 className="text-sm font-medium text-gray-200 mb-2">
                            New Startup Command
                        </h4>

                        {/* Managed Command Dropdown */}
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">
                                Load from saved
                            </label>
                            <select
                                onChange={handleManagedSelect}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Choose a saved command...</option>
                                {managedCommands.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title || "Untitled"} - {c.command.substring(0, 30)}
                                        {c.group_name !== "All Commands"
                                            ? ` [${c.group_name}]`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Directory</label>
                            <input
                                value={formData.dir}
                                onChange={(e) => setFormData({ ...formData, dir: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Header</label>
                            <textarea
                                value={formData.header}
                                onChange={(e) =>
                                    setFormData({ ...formData, header: e.target.value })
                                }
                                rows={2}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Command *</label>
                            <textarea
                                value={formData.command}
                                onChange={(e) =>
                                    setFormData({ ...formData, command: e.target.value })
                                }
                                rows={2}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Footer</label>
                            <textarea
                                value={formData.footer}
                                onChange={(e) =>
                                    setFormData({ ...formData, footer: e.target.value })
                                }
                                rows={2}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">
                                Delay (seconds)
                            </label>
                            <input
                                type="number"
                                value={formData.delay}
                                onChange={(e) =>
                                    setFormData({ ...formData, delay: e.target.value })
                                }
                                min="0"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm text-gray-200 transition"
                            >
                                <VscAdd size={14} />
                                Add to Startup
                            </button>
                            <button
                                onClick={handleDiscard}
                                className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-2">
                        <button
                            onClick={handleNew}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-750 border border-gray-600/50 rounded-lg text-sm text-gray-300 hover:text-gray-200 transition"
                        >
                            <VscAdd size={16} />
                            <span>Add New Startup Command</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
