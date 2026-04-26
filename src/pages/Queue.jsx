import { useEffect, useState, useCallback } from "react";
import { useQueueStore } from "../stores/queueStore";
import { useCommandsStore } from "../stores/commandsStore";
import { useTerminalTabs } from "../stores/terminalStore";
import DirectoryPicker from "../components/DirectoryPicker";
import {
    VscEdit,
    VscTrash,
    VscPlay,
    VscDebugStop,
    VscAdd,
    VscChevronUp,
    VscChevronDown,
    VscGrabber,
    VscFolderOpened,
    VscCheck,
    VscError,
    VscWarning,
    VscLoading,
    VscClearAll,
    VscDebugRerun,
    VscCopy,
} from "react-icons/vsc";

export default function Queue() {
    const {
        items,
        loading,
        error,
        stats,
        fetch,
        add,
        update,
        remove,
        clearAll,
        reorder,
        moveItem,
        updateStatus,
        duplicate,
        setRunning,
        setCompleted,
        setFailed,
    } = useQueueStore();

    const { managedCommands, fetch: fetchCommands } = useCommandsStore();
    const { tabs, activeTabId, setCwd } = useTerminalTabs();

    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        dir: "~",
        header: "",
        command: "",
        footer: "",
    });

    // UI state
    const [executing, setExecuting] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    useEffect(() => {
        fetch();
        fetchCommands();

        // Listen for execution events
        const cleanupStarted = window.api.onQueueExecutionStarted?.((data) => {
            console.log("Execution started:", data);
            setIsExecuting(true);
        });

        const cleanupCompleted = window.api.onQueueExecutionCompleted?.((result) => {
            console.log("Execution completed:", result);
            setIsExecuting(false);
            fetch();
        });

        const cleanupStopped = window.api.onQueueItemStopped?.((item) => {
            console.log("Item stopped:", item);
            setStopped(item.id);
            fetch();
        });

        const cleanupStopping = window.api.onQueueStopping?.(() => {
            setIsExecuting(false);
        });

        return () => {
            cleanupStarted?.();
            cleanupCompleted?.();
            cleanupStopped?.();
            cleanupStopping?.();
        };
    }, []);

    // Reset form
    const resetForm = useCallback(() => {
        setFormData({
            dir: "~",
            header: "",
            command: "",
            footer: "",
        });
        setIsEditing(false);
        setEditingId(null);
    }, []);

    // Handle managed command selection
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

    // Add or update queue item
    const handleSubmit = async () => {
        if (!formData.command.trim()) return;

        try {
            if (isEditing && editingId) {
                await update(editingId, formData);
            } else {
                await add(formData);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to save queue item:", error);
        }
    };

    // Edit existing item
    const handleEdit = (item) => {
        setFormData({
            dir: item.dir || "~",
            header: item.header || "",
            command: item.command,
            footer: item.footer || "",
        });
        setIsEditing(true);
        setEditingId(item.id);
        // Scroll to form
        document.getElementById("queue-form")?.scrollIntoView({ behavior: "smooth" });
    };

    // Execute single command now
    const executeNow = async (item) => {
        try {
            let queueItem = item;

            // If new item without ID, add to queue first
            if (!item.id) {
                queueItem = await add(item);
            }

            // Update status to running
            setRunning(queueItem.id);
            await updateStatus(queueItem.id, "running");

            // Listen for completion
            const cleanupComplete = window.api.onCommandComplete(queueItem.id, async (result) => {
                console.log("Command completed:", result);

                if (result.status === "completed") {
                    setCompleted(queueItem.id);
                    await updateStatus(queueItem.id, "completed");
                } else {
                    setFailed(queueItem.id, result.error || "Command failed");
                    await updateStatus(queueItem.id, "failed");
                }

                cleanupComplete();
                await fetch();
                window.api.onHistoryUpdated?.();
            });

            // Execute the command
            await window.api.executeCommand(queueItem);
        } catch (error) {
            console.error("Failed to execute command:", error);
            if (item.id) {
                setFailed(item.id, error.message);
                await updateStatus(item.id, "failed");
                await fetch();
            }
        }
    };

    // Run entire queue
    const runQueue = async () => {
        if (isExecuting) return;

        setIsExecuting(true);

        try {
            // Set up listeners before starting
            const cleanupStarted = window.api.onQueueExecutionStarted?.((data) => {
                console.log("Queue execution started:", data);
            });

            const cleanupRunning = window.api.onQueueItemRunning?.((item) => {
                setRunning(item.id);
            });

            const cleanupCompleted = window.api.onQueueItemCompleted?.((item) => {
                setCompleted(item.id);
            });

            const cleanupFailed = window.api.onQueueItemFailed?.((item) => {
                setFailed(item.id, item.error);
            });

            const cleanupFinished = window.api.onQueueExecutionCompleted?.((result) => {
                console.log("Queue execution finished:", result);
                setIsExecuting(false);

                // Clean up all listeners
                cleanupStarted?.();
                cleanupRunning?.();
                cleanupCompleted?.();
                cleanupFailed?.();
                cleanupFinished?.();

                // Refresh stores
                fetch();

                // Trigger history refresh
                window.api.onHistoryUpdated?.();
            });

            // Start queue execution
            const result = await window.api.runQueue();
            console.log("Queue execution result:", result);

            if (result.total === 0) {
                setIsExecuting(false);
                // Clean up listeners
                cleanupStarted?.();
                cleanupRunning?.();
                cleanupCompleted?.();
                cleanupFailed?.();
                cleanupFinished?.();
            }
        } catch (error) {
            console.error("Failed to execute queue:", error);
            setIsExecuting(false);
        }
    };

    // Stop running command
    const stopCommand = async (id) => {
        try {
            await window.api.stopCommand(id);
            await updateStatus(id, "stopped");
        } catch (error) {
            console.error("Failed to stop command:", error);
        }
    };

    // Set directory for terminal tab
    const setTerminalDir = (dir) => {
        if (activeTabId) {
            setCwd(activeTabId, dir);
            window.api.terminalChangeDir(activeTabId, dir);
        }
    };

    // Drag and drop handlers
    const handleDragStart = (index) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
            reorder(draggedIndex, dragOverIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status) {
            case "completed":
                return <VscCheck className="text-green-400" />;
            case "running":
                return <VscLoading className="text-blue-400 animate-spin" />;
            case "failed":
                return <VscError className="text-red-400" />;
            case "stopped":
                return <VscWarning className="text-yellow-400" />;
            case "queued":
                return <VscDebugRerun className="text-purple-400" />;
            default:
                return <VscGrabber className="text-gray-500" />;
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case "completed":
                return "border-green-500/30 bg-green-500/5";
            case "running":
                return "border-blue-500/30 bg-blue-500/5";
            case "failed":
                return "border-red-500/30 bg-red-500/5";
            case "stopped":
                return "border-yellow-500/30 bg-yellow-500/5";
            default:
                return "border-gray-700/50 bg-gray-800/50";
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Queue Stats Bar */}
            {stats.total > 0 && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-800/50 border-b border-gray-700/50 text-xs text-gray-400">
                    <span>Total: {stats.total}</span>
                    {stats.pending > 0 && (
                        <span className="text-gray-500">Pending: {stats.pending}</span>
                    )}
                    {stats.running > 0 && (
                        <span className="text-blue-400">Running: {stats.running}</span>
                    )}
                    {stats.completed > 0 && (
                        <span className="text-green-400">Done: {stats.completed}</span>
                    )}
                    {stats.failed > 0 && (
                        <span className="text-red-400">Failed: {stats.failed}</span>
                    )}

                    <button
                        onClick={() => clearAll()}
                        className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300 transition"
                        title="Clear all queue items"
                    >
                        <VscClearAll size={12} />
                        Clear All
                    </button>
                </div>
            )}

            {/* Queue Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        Queue is empty. Add commands below.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.id}
                            draggable={item.status === "pending"}
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`border rounded-lg transition-all cursor-pointer ${getStatusColor(
                                item.status,
                            )} ${
                                dragOverIndex === index
                                    ? "border-blue-400/50 ring-1 ring-blue-400/30"
                                    : ""
                            } ${draggedIndex === index ? "opacity-50" : ""}`}
                        >
                            {/* Item Header */}
                            <div className="flex items-center gap-2 px-3 py-2">
                                {/* Drag handle */}
                                <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                                    <VscGrabber size={14} />
                                </div>

                                {/* Status */}
                                <div title={item.status}>{getStatusIcon(item.status)}</div>

                                {/* Order */}
                                <span className="text-xs text-gray-600 font-mono">
                                    #{index + 1}
                                </span>

                                {/* Directory */}
                                <button
                                    onClick={() => setTerminalDir(item.dir)}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition px-1.5 py-0.5 rounded hover:bg-gray-700/50"
                                    title="Set as terminal directory"
                                >
                                    <VscFolderOpened size={12} />
                                    <span className="font-mono truncate max-w-30">
                                        {item.dir?.replace(/.*\//, "") || "~"}
                                    </span>
                                </button>

                                {/* Command preview */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-200 font-mono truncate">
                                        {item.header && (
                                            <span className="text-gray-500">{item.header}; </span>
                                        )}
                                        {item.command}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    {item.status === "pending" && (
                                        <>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-yellow-400 transition"
                                                title="Edit"
                                            >
                                                <VscEdit size={12} />
                                            </button>
                                            <button
                                                onClick={() => moveItem(item.id, "up")}
                                                disabled={index === 0}
                                                className="p-1 hover:bg-gray-700/50 rounded text-gray-400 disabled:opacity-30 transition"
                                                title="Move up"
                                            >
                                                <VscChevronUp size={12} />
                                            </button>
                                            <button
                                                onClick={() => moveItem(item.id, "down")}
                                                disabled={index === items.length - 1}
                                                className="p-1 hover:bg-gray-700/50 rounded text-gray-400 disabled:opacity-30 transition"
                                                title="Move down"
                                            >
                                                <VscChevronDown size={12} />
                                            </button>
                                            <button
                                                onClick={() => executeNow(item)}
                                                className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-green-400 transition"
                                                title="Execute now"
                                            >
                                                <VscPlay size={12} />
                                            </button>
                                        </>
                                    )}
                                    {item.status === "running" && (
                                        <button
                                            onClick={() => stopCommand(item.id)}
                                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-red-400 transition"
                                            title="Stop"
                                        >
                                            <VscDebugStop size={12} />
                                        </button>
                                    )}
                                    {item.status !== "running" && (
                                        <button
                                            onClick={() => remove(item.id)}
                                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-red-400 transition"
                                            title="Delete"
                                        >
                                            <VscTrash size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded details (optional) */}
                            {item.footer && (
                                <div className="px-3 pb-2">
                                    <div className="text-xs text-gray-500 font-mono border-t border-gray-700/30 pt-1">
                                        {item.footer}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add/Edit Form */}
            <div
                id="queue-form"
                className="border-t border-gray-700/50 bg-gray-800/50 p-3 space-y-2"
            >
                <h4 className="text-sm font-medium text-gray-200">
                    {isEditing ? "Edit Command" : "Add New Command"}
                </h4>

                {/* Managed Command Dropdown */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Load from saved</label>
                    <select
                        onChange={handleManagedSelect}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                    >
                        <option value="">Choose a saved command...</option>
                        {managedCommands.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.title || c.command.substring(0, 40)}
                                {c.group_name !== "All Commands" ? ` [${c.group_name}]` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Directory */}
                <DirectoryPicker
                    value={formData.dir}
                    onChange={(newDir) => setFormData({ ...formData, dir: newDir })}
                    showValidation={true}
                    label="Directory"
                    placeholder="~ (home directory)"
                />

                {/* Header */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">
                        Header{" "}
                        <span className="text-gray-600">(optional - runs before command)</span>
                    </label>
                    <textarea
                        value={formData.header}
                        onChange={(e) => setFormData({ ...formData, header: e.target.value })}
                        rows={2}
                        placeholder="source /usr/local/gromacs/bin/GMXRC"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                {/* Command */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">
                        Command <span className="text-red-400">*</span>
                    </label>
                    <textarea
                        value={formData.command}
                        onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                        rows={3}
                        placeholder="gmx mdrun -deffnm npt"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                {/* Footer */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">
                        Footer{" "}
                        <span className="text-gray-600">(optional - runs after command)</span>
                    </label>
                    <textarea
                        value={formData.footer}
                        onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                        rows={2}
                        placeholder="echo 'Simulation complete'"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.command.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-gray-200 transition"
                    >
                        {isEditing ? <VscEdit size={14} /> : <VscAdd size={14} />}
                        {isEditing ? "Update" : "Add to Queue"}
                    </button>

                    {isEditing && (
                        <button
                            onClick={resetForm}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
                        >
                            Cancel
                        </button>
                    )}

                    {!isEditing && formData.command.trim() && (
                        <button
                            onClick={() => executeNow(formData)}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-sm text-gray-200 transition"
                        >
                            <VscPlay size={14} />
                            Execute Now
                        </button>
                    )}
                </div>
            </div>

            {/* Error toast */}
            {error && (
                <div className="absolute bottom-20 right-4 bg-red-900/90 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-200">
                    {error}
                    <button
                        onClick={() => useQueueStore.getState().clearError()}
                        className="ml-2 text-red-400 hover:text-red-300"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
