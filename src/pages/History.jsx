import { useEffect, useState } from "react";
import { useHistoryStore } from "../stores/historyStore";
import { useCommandsStore } from "../stores/commandsStore";
import {
    VscChevronDown,
    VscChevronRight,
    VscTrash,
    VscDebugRerun,
    VscAdd,
    VscCheck,
    VscError,
    VscWarning,
    VscFilter,
} from "react-icons/vsc";

export default function History() {
    const {
        items,
        fetch,
        deleteHistory,
        deleteSingle,
        retryCommand,
        addToGroup,
        clearFilter,
        setFilter,
    } = useHistoryStore();
    const { groups, fetchGroups } = useCommandsStore();

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [statusFilter, setStatusFilter] = useState("all");
    const [showGroupMenu, setShowGroupMenu] = useState(null);
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        fetch();
        fetchGroups();
    }, []);

    const toggleExpand = (id) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
        setSelectAll(false);
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedIds(new Set());
            setSelectAll(false);
        } else {
            const filteredItems =
                statusFilter === "all"
                    ? items
                    : items.filter((item) => item.status === statusFilter);
            setSelectedIds(new Set(filteredItems.map((item) => item.id)));
            setSelectAll(true);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size > 0) {
            await deleteHistory(Array.from(selectedIds));
            setSelectedIds(new Set());
            setSelectAll(false);
        }
    };

    const handleRetry = async (item) => {
        await retryCommand(item);
    };

    const handleAddToGroup = async (historyId, groupName) => {
        await addToGroup(historyId, groupName);
        setShowGroupMenu(null);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "successful":
                return <VscCheck className="text-green-400" />;
            case "terminated":
                return <VscWarning className="text-yellow-400" />;
            case "error":
            case "failed":
                return <VscError className="text-red-400" />;
            default:
                return null;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "successful":
                return "border-green-500/30 bg-green-500/5";
            case "terminated":
                return "border-yellow-500/30 bg-yellow-500/5";
            case "error":
            case "failed":
                return "border-red-500/30 bg-red-500/5";
            default:
                return "border-gray-700/50";
        }
    };

    const filteredItems =
        statusFilter === "all" ? items : items.filter((item) => item.status === statusFilter);

    useEffect(() => {
        // Initial fetch
        fetch();
        fetchGroups();

        // Listen for history updates from main process
        if (window.api.onHistoryUpdated) {
            window.api.onHistoryUpdated(() => {
                fetch();
            });
        }

        // Listen for queue execution events
        if (window.api.onQueueExecutionCompleted) {
            window.api.onQueueExecutionCompleted(() => {
                fetch(); // Refresh history when queue execution completes
            });
        }

        if (window.api.onQueueItemCompleted) {
            window.api.onQueueItemCompleted(() => {
                fetch(); // Refresh history when a queue item completes
            });
        }
    }, []);

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-gray-700/50 bg-gray-800/50">
                <button
                    onClick={toggleSelectAll}
                    className={`text-xs px-2 py-1 rounded transition ${
                        selectAll
                            ? "bg-blue-600/50 text-blue-200"
                            : "hover:bg-gray-700/50 text-gray-300"
                    }`}
                >
                    {selectAll ? "Deselect All" : "Select All"}
                </button>

                <div className="flex items-center gap-1 ml-2">
                    <VscFilter className="text-gray-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setSelectedIds(new Set());
                            setSelectAll(false);
                        }}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none"
                    >
                        <option value="all">All Status</option>
                        <option value="successful">Successful</option>
                        <option value="terminated">Terminated</option>
                        <option value="error">Error</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>

                {selectedIds.size > 0 && (
                    <button
                        onClick={handleDeleteSelected}
                        className="ml-auto flex items-center gap-1 text-xs px-2 py-1 bg-red-700/50 hover:bg-red-600/50 text-red-200 rounded transition"
                    >
                        <VscTrash size={12} />
                        Delete ({selectedIds.size})
                    </button>
                )}
            </div>

            {/* History List */}
            <div className="flex-1 h-full overflow-y-auto p-2 space-y-2 pb-10">
                {filteredItems.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        No history items found
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className={`border rounded-lg transition-all ${getStatusColor(item.status)} ${
                                selectedIds.has(item.id) ? "ring-1 ring-blue-400/50" : ""
                            }`}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2 p-2">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(item.id)}
                                    onChange={() => toggleSelect(item.id)}
                                    className="rounded border-gray-500 bg-gray-700"
                                />

                                <button
                                    onClick={() => toggleExpand(item.id)}
                                    className="text-gray-400 hover:text-gray-200 transition"
                                >
                                    {expandedItems.has(item.id) ? (
                                        <VscChevronDown size={14} />
                                    ) : (
                                        <VscChevronRight size={14} />
                                    )}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-mono truncate">
                                            {item.dir || "~"}
                                        </span>
                                        {getStatusIcon(item.status)}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {/* Add to Group Menu */}
                                    <div className="relative">
                                        <button
                                            onClick={() =>
                                                setShowGroupMenu(
                                                    showGroupMenu === item.id ? null : item.id,
                                                )
                                            }
                                            className="p-1 hover:bg-gray-700/50 rounded transition text-gray-400 hover:text-gray-200"
                                            title="Add to group"
                                        >
                                            <VscAdd size={12} />
                                        </button>
                                        {showGroupMenu === item.id && (
                                            <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-600 rounded shadow-lg z-10">
                                                {groups.map((group) => (
                                                    <button
                                                        key={group}
                                                        onClick={() =>
                                                            handleAddToGroup(item.id, group)
                                                        }
                                                        className="block w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition"
                                                    >
                                                        {group}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleRetry(item)}
                                        className="p-1 hover:bg-gray-700/50 rounded transition text-gray-400 hover:text-green-400"
                                        title="Run again"
                                    >
                                        <VscDebugRerun size={12} />
                                    </button>

                                    <button
                                        onClick={() => deleteSingle(item.id)}
                                        className="p-1 hover:bg-gray-700/50 rounded transition text-gray-400 hover:text-red-400"
                                        title="Delete"
                                    >
                                        <VscTrash size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedItems.has(item.id) && (
                                <div className="px-4 pb-3 space-y-2">
                                    {/* Command */}
                                    <div className="space-y-1">
                                        <div className="text-xs text-gray-500 font-medium">
                                            Command:
                                        </div>
                                        <div className="bg-gray-950/50 rounded p-2 font-mono text-xs text-gray-300 min-h-12">
                                            {(item.header ? item.header + "\n" : "") +
                                                item.command +
                                                (item.footer ? "\n" + item.footer : "")}
                                        </div>
                                    </div>

                                    {/* Log */}
                                    <div className="space-y-1">
                                        <div className="text-xs text-gray-500 font-medium">
                                            Log (last 3 lines):
                                        </div>
                                        <div className="bg-gray-950/50 rounded p-2 font-mono text-xs text-gray-400 min-h-20 whitespace-pre-wrap">
                                            {item.log || "No output available"}
                                        </div>
                                    </div>

                                    {/* Timestamp */}
                                    <div className="text-xs text-gray-600">
                                        {new Date(item.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
