import React, { useEffect, useMemo, useState } from "react";
import Dropdown from "../../components/Dropdown";
import { MdDelete, MdQueue } from "react-icons/md";
import { RiLoopRightFill } from "react-icons/ri";

export default function HistoryPage() {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("all");

    async function loadHistory() {
        const rows = await window.api.history.list();
        setItems(rows);
    }

    useEffect(() => {
        loadHistory();
    }, []);

    const filteredItems = useMemo(() => {
        if (filter === "all") {
            return items;
        }

        return items.filter((item) => item.status === filter);
    }, [filter, items]);

    return (
        <div className="space-y-4 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-48">
                    <Dropdown
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { label: "All history", value: "all" },
                            { label: "Success", value: "success" },
                            { label: "Failed", value: "failed" },
                            { label: "Terminated", value: "terminated" },
                        ]}
                    />
                </div>

                <button
                    type="button"
                    onClick={async () => {
                        await window.api.history.clear();
                        await loadHistory();
                    }}
                    className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-gray-100 cursor-pointer"
                >
                    <MdDelete className="text-lg mr-2"/>
                    Clear history
                </button>
            </div>

            <div className="space-y-3">
                {filteredItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900/70 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-gray-200">{item.dir}</div>
                                <div className="text-xs text-gray-500">{item.timestamp}</div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="rounded-full border border-gray-700 px-2 py-1 text-xs uppercase tracking-wide text-gray-400">
                                    {item.status}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => window.api.queue.create(item)}
                                    className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                                >
                                    <MdQueue className="text-lg mr-2"/>
                                    Add to queue
                                </button>

                                <button
                                    type="button"
                                    onClick={() => window.api.terminal.execute(item)}
                                    className="flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                                >
                                    <RiLoopRightFill className="text-lg mr-2"/>
                                    Retry
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await window.api.history.delete(item.id);
                                        await loadHistory();
                                    }}
                                    className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-red-200"
                                >
                                    <MdDelete className="text-lg mr-2"/>
                                    Delete
                                </button>
                            </div>
                        </div>

                        <details className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                            <summary className="cursor-pointer text-sm text-gray-300">Command</summary>
                            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-400">
                                {[item.header, item.command, item.footer].filter(Boolean).join("\n")}
                            </pre>
                        </details>

                        <details className="mt-3 rounded-md border border-gray-800 bg-gray-950/40 p-3">
                            <summary className="cursor-pointer text-sm text-gray-300">Log</summary>
                            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-400">
                                {item.log || "No output captured."}
                            </pre>
                        </details>
                    </div>
                ))}

                {!filteredItems.length ? (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
                        History items will appear here.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
