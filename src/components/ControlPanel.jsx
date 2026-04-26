import { useState } from "react";
import Queue from "../pages/Queue.jsx";
import History from "../pages/History.jsx";
import Manager from "../pages/Manager.jsx";
import Startup from "../pages/Startup.jsx";

const tabs = ["Queue", "History", "Manager", "Startup"];

export default function ControlPanel() {
    const [active, setActive] = useState("Queue");
    return (
        <div className="flex flex-col h-full">
            {/* Top navbar */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700/50 bg-gray-800/50">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActive(tab)}
                        className={`px-3 py-1 text-xs rounded-t transition ${
                            active === tab
                                ? "bg-gray-900 text-gray-100"
                                : "hover:bg-gray-700/50 text-gray-400"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            {/* Page content */}
            <div className="flex-1 overflow-y-auto">
                {active === "Queue" && <Queue />}
                {active === "History" && <History />}
                {active === "Manager" && <Manager />}
                {active === "Startup" && <Startup />}
            </div>
        </div>
    );
}
