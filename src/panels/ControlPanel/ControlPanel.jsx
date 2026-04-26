import React, { useState } from "react";
import QueuePage from "./QueuePage";
import HistoryPage from "./HistoryPage";
import ManagerPage from "./ManagerPage";
import StartupPage from "./StartupPage";

export default function ControlPanel() {
    const [page, setPage] = useState("queue");
    const pages = [
        { id: "queue", label: "Queue" },
        { id: "history", label: "History" },
        { id: "manager", label: "Manager" },
        { id: "startup", label: "Startup" },
    ];

    return (
        <div className="flex h-full min-h-0 flex-col border-r border-gray-800 bg-gray-950/50 scrollbar-dark">
            <div className="flex flex-wrap h-8 border-b border-gray-800 bg-gray-900/80 px-2">
                {pages.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`px-3 py-1 text-sm transition ${
                            page === item.id
                                ? "bg-gray-200 text-gray-900"
                                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto">
                {page === "queue" && <QueuePage />}
                {page === "history" && <HistoryPage />}
                {page === "manager" && <ManagerPage />}
                {page === "startup" && <StartupPage />}
            </div>
        </div>
    );
}
