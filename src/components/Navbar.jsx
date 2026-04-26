import { useEffect, useState } from "react";
import {
    VscChromeMinimize,
    VscChromeMaximize,
    VscChromeRestore,
    VscChromeClose,
    VscTerminal,
    VscClearAll,
    VscPlay,
    VscDebugStop
} from "react-icons/vsc";
import { useQueueStore } from "../stores/queueStore";
import { useHistoryStore } from "../stores/historyStore";

export default function Navbar() {
    const [maximized, setMaximized] = useState(false);
    const [focused, setFocused] = useState(true);
    const [isRunningQueue, setIsRunningQueue] = useState(false);

    const { clearAll, fetch: fetchQueue } = useQueueStore();
    const { fetch: fetchHistory } = useHistoryStore();

    useEffect(() => {
        // Check initial maximize state
        window.api.isMaximized().then(setMaximized);

        // Listen for maximize changes
        window.api.onMaximizeChange((isMaximized) => {
            setMaximized(isMaximized);
        });

        // Listen for focus changes
        if (window.api.onFocusChange) {
            window.api.onFocusChange((isFocused) => {
                setFocused(isFocused);
            });
        }

        // Listen for queue execution events
        if (window.api.onQueueExecutionStarted) {
            window.api.onQueueExecutionStarted(() => {
                setIsRunningQueue(true);
            });
        }

        if (window.api.onQueueExecutionCompleted) {
            window.api.onQueueExecutionCompleted(() => {
                setIsRunningQueue(false);
                // Refresh both queue and history after execution
                fetchQueue();
                fetchHistory();
            });
        }
    }, []);

    const handleClearQueue = async () => {
        try {
            await clearAll();
            // Optionally show a notification
            console.log("Queue cleared");
        } catch (error) {
            console.error("Failed to clear queue:", error);
        }
    };

    const handleRunQueue = async () => {
        try {
            setIsRunningQueue(true);

            // Listen for queue completion
            window.api.onQueueExecutionCompleted(async (result) => {
                console.log("Queue execution completed:", result);
                setIsRunningQueue(false);

                // Refresh stores
                await fetchQueue();
                await fetchHistory();
            });

            // Start queue execution
            await window.api.runQueue();
        } catch (error) {
            console.error("Failed to run queue:", error);
            setIsRunningQueue(false);
        }
    };

    const handleMaximizeRestore = () => {
        if (maximized) {
            window.api.restore();
        } else {
            window.api.maximize();
        }
    };

    return (
        <nav
            className={`flex items-center justify-between h-10 px-4 select-none border-b border-gray-700/50 backdrop-blur transition-colors ${
                focused ? "bg-gray-850 text-gray-200" : "bg-gray-850/80 text-gray-400"
            }`}
            style={{ WebkitAppRegion: "drag" }}
        >
            <div className="flex items-center gap-3" style={{ WebkitAppRegion: "no-drag" }}>
                <VscTerminal className="text-green-400 text-lg" />
                <span className="text-sm font-medium tracking-wide">TerminalQueue</span>
            </div>

            <div className="flex items-center gap-2 text-sm" style={{ WebkitAppRegion: "no-drag" }}>
                {/* Clear Queue Button */}
                <button
                    onClick={handleClearQueue}
                    className="flex items-center gap-1 hover:bg-red-700/30 px-2 py-1 rounded transition text-xs text-gray-300 hover:text-red-200"
                    title="Clear all queued commands"
                >
                    <VscClearAll size={14} />
                    Clear Queue
                </button>

                {/* Run Queue / Stop Queue Button */}
                {isRunningQueue ? (
                    <button
                        onClick={async () => {
                            try {
                                await window.api.stopQueueExecution();
                                setIsRunningQueue(false);
                            } catch (error) {
                                console.error("Failed to stop queue:", error);
                            }
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded transition text-xs bg-red-700/50 hover:bg-red-600/50 text-red-200"
                        title="Stop queue execution"
                    >
                        <VscDebugStop size={14} />
                        Stop Queue
                    </button>
                ) : (
                    <button
                        onClick={handleRunQueue}
                        className="flex items-center gap-1 hover:bg-green-700/30 px-2 py-1 rounded transition text-xs text-gray-300 hover:text-green-200"
                        title="Execute all queued commands"
                    >
                        <VscPlay size={14} />
                        Run Queue
                    </button>
                )}

                <span className="w-px h-5 bg-gray-700 mx-1" />

                {/* Minimize */}
                <button
                    onClick={() => window.api.minimize()}
                    className="hover:bg-gray-700/40 p-1 rounded transition"
                    title="Minimize"
                >
                    <VscChromeMinimize size={16} />
                </button>

                {/* Maximize/Restore */}
                <button
                    onClick={handleMaximizeRestore}
                    className="hover:bg-gray-700/40 p-1 rounded transition"
                    title={maximized ? "Restore Down" : "Maximize"}
                >
                    {maximized ? <VscChromeRestore size={16} /> : <VscChromeMaximize size={16} />}
                </button>

                {/* Close to Tray */}
                <button
                    onClick={() => window.api.close()}
                    className="hover:bg-red-600/70 p-1 rounded transition"
                    title="Close to System Tray"
                >
                    <VscChromeClose size={16} />
                </button>
            </div>
        </nav>
    );
}
