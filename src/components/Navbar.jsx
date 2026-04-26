import { useEffect, useState, useRef } from "react";
import {
    VscChromeMinimize,
    VscChromeMaximize,
    VscChromeRestore,
    VscChromeClose,
    VscTerminal,
    VscClearAll,
    VscPlay,
    VscDebugStop,
} from "react-icons/vsc";
import { useQueueStore } from "../stores/queueStore";

export default function Navbar() {
    const [maximized, setMaximized] = useState(false);
    const [focused, setFocused] = useState(true);
    const [isRunningQueue, setIsRunningQueue] = useState(false);
    const isRunningRef = useRef(false); // Use ref to avoid stale closures

    const { clearAll, fetch: fetchQueue } = useQueueStore();

    useEffect(() => {
        window.api.isMaximized().then(setMaximized);

        window.api.onMaximizeChange((isMaximized) => {
            setMaximized(isMaximized);
        });

        if (window.api.onFocusChange) {
            window.api.onFocusChange((isFocused) => {
                setFocused(isFocused);
            });
        }

        // Listen for queue execution events
        const cleanupStarted = window.api.onQueueExecutionStarted?.((data) => {
            console.log("Queue execution started:", data);
            setIsRunningQueue(true);
            isRunningRef.current = true;
        });

        const cleanupCompleted = window.api.onQueueExecutionCompleted?.((result) => {
            console.log("Queue execution completed:", result);
            setIsRunningQueue(false);
            isRunningRef.current = false;
            // Refresh queue after completion
            fetchQueue();
        });

        return () => {
            cleanupStarted?.();
            cleanupCompleted?.();
        };
    }, []);

    const handleClearQueue = async () => {
        try {
            await clearAll();
        } catch (error) {
            console.error("Failed to clear queue:", error);
        }
    };

    const handleRunQueue = async () => {
        if (isRunningRef.current) return;

        try {
            setIsRunningQueue(true);
            isRunningRef.current = true;

            console.log("Starting queue execution...");
            const result = await window.api.runQueue();
            console.log("Queue execution result:", result);

            setIsRunningQueue(false);
            isRunningRef.current = false;
            await fetchQueue();
        } catch (error) {
            console.error("Failed to run queue:", error);
            setIsRunningQueue(false);
            isRunningRef.current = false;
        }
    };

    const handleStopQueue = async () => {
        try {
            console.log("Stopping queue execution...");
            await window.api.stopQueueExecution();
            // State will be updated via events
        } catch (error) {
            console.error("Failed to stop queue:", error);
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
                {isRunningQueue && (
                    <span className="text-xs text-yellow-400 animate-pulse">● Running</span>
                )}
            </div>

            <div className="flex items-center gap-2 text-sm" style={{ WebkitAppRegion: "no-drag" }}>
                {/* Clear Queue Button (hidden during execution) */}
                {!isRunningQueue && (
                    <button
                        onClick={handleClearQueue}
                        className="flex items-center gap-1 hover:bg-red-700/30 px-2 py-1 rounded transition text-xs text-gray-300 hover:text-red-200"
                        title="Clear all queued commands"
                    >
                        <VscClearAll size={14} />
                        Clear Queue
                    </button>
                )}

                {/* Run Queue / Stop Queue Button */}
                {isRunningQueue ? (
                    <button
                        onClick={handleStopQueue}
                        className="flex items-center gap-1 px-2 py-1 rounded transition text-xs bg-red-700/50 hover:bg-red-600/50 text-red-200 animate-pulse"
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
