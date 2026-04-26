import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useTerminalTabs } from "../stores/terminalStore";
import { VscAdd, VscClose, VscTerminal } from "react-icons/vsc";
import "xterm/css/xterm.css";

export default function TerminalPanel() {
    const { tabs, activeTabId, addTab, removeTab, setActive, setCwd, homeDir } = useTerminalTabs();

    const terminalRefs = useRef({}); // Store terminal instances
    const fitAddonRefs = useRef({}); // Store fit addons
    const containerRefs = useRef({}); // Store container elements
    const listenersRef = useRef({}); // Store event listeners

    // Initialize terminal for a specific tab
    const initializeTerminal = useCallback(
        async (tabId) => {
            const container = containerRefs.current[tabId];
            if (!container) {
                console.warn(`Container not found for tab ${tabId}`);
                return;
            }

            // Clean up existing terminal if any
            if (terminalRefs.current[tabId]) {
                try {
                    terminalRefs.current[tabId].dispose();
                } catch (err) {
                    console.warn("Error disposing terminal:", err);
                }
            }

            // Clean up existing listeners
            if (listenersRef.current[tabId]) {
                try {
                    window.api.removeTerminalListener(tabId);
                } catch (err) {
                    console.warn("Error removing listener:", err);
                }
            }

            console.log(`Creating terminal for tab ${tabId}`);

            // Create new terminal instance
            const term = new Terminal({
                cursorBlink: true,
                convertEol: true,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Mono', monospace",
                lineHeight: 1.25,
                scrollback: 5000,
                allowProposedApi: true,
                theme: {
                    background: "#030712",
                    foreground: "#d1d5db",
                    cursor: "#f9fafb",
                    selectionBackground: "#37415180",
                    black: "#1f2937",
                    red: "#ef4444",
                    green: "#10b981",
                    yellow: "#f59e0b",
                    blue: "#3b82f6",
                    magenta: "#8b5cf6",
                    cyan: "#06b6d4",
                    white: "#d1d5db",
                    brightBlack: "#4b5563",
                    brightRed: "#f87171",
                    brightGreen: "#34d399",
                    brightYellow: "#fbbf24",
                    brightBlue: "#60a5fa",
                    brightMagenta: "#a78bfa",
                    brightCyan: "#22d3ee",
                    brightWhite: "#f9fafb",
                },
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            // Store references
            terminalRefs.current[tabId] = term;
            fitAddonRefs.current[tabId] = fitAddon;

            // Open terminal in container
            try {
                term.open(container);
                fitAddon.fit();
            } catch (err) {
                console.error("Error opening terminal:", err);
                return;
            }

            // Get tab info for cwd
            const tab = tabs.find((t) => t.id === tabId);
            const cwd = tab?.cwd || "~";

            // Create PTY process with proper directory
            try {
                console.log(`Creating PTY for tab ${tabId} in directory: ${cwd}`);
                await window.api.terminalCreate({
                    tabId,
                    cols: term.cols,
                    rows: term.rows,
                    cwd: cwd,
                });
            } catch (err) {
                console.error("Error creating PTY:", err);
                term.writeln("\r\n\x1b[31mError: Failed to start terminal session\x1b[0m");
                term.writeln(`\x1b[31m${err.message}\x1b[0m`);
                return;
            }

            // Listen for terminal data from main process
            const dataHandler = (data) => {
                try {
                    if (terminalRefs.current[tabId]) {
                        terminalRefs.current[tabId].write(data);
                    }
                } catch (err) {
                    console.error("Error writing to terminal:", err);
                }
            };

            window.api.onTerminalData(tabId, dataHandler);
            listenersRef.current[tabId] = dataHandler;

            // Handle terminal input
            term.onData((data) => {
                try {
                    window.api.terminalWrite(tabId, data);
                } catch (err) {
                    console.error("Error sending terminal input:", err);
                }
            });

            // Handle terminal exit
            const exitHandler = (exitCode) => {
                if (terminalRefs.current[tabId]) {
                    terminalRefs.current[tabId].writeln(
                        `\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m`,
                    );
                }
            };

            window.api.onTerminalExit?.(tabId, exitHandler);

            // Handle resize
            const resizeObserver = new ResizeObserver(() => {
                if (fitAddonRefs.current[tabId] && terminalRefs.current[tabId]) {
                    try {
                        fitAddonRefs.current[tabId].fit();
                        const term = terminalRefs.current[tabId];
                        window.api.terminalResize(tabId, term.rows, term.cols);
                    } catch (err) {
                        console.error("Error resizing terminal:", err);
                    }
                }
            });

            resizeObserver.observe(container);

            // Store cleanup function
            container._resizeObserver = resizeObserver;
            container._exitHandler = exitHandler;

            // Focus terminal
            term.focus();
        },
        [tabs],
    );

    // Initialize active tab
    useEffect(() => {
        if (activeTabId) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                initializeTerminal(activeTabId);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTabId, initializeTerminal]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            // Clean up all terminals
            Object.keys(terminalRefs.current).forEach((tabId) => {
                try {
                    if (terminalRefs.current[tabId]) {
                        terminalRefs.current[tabId].dispose();
                    }
                    if (listenersRef.current[tabId]) {
                        window.api.removeTerminalListener(tabId);
                    }
                    window.api.terminalKill(tabId);
                } catch (err) {
                    console.warn(`Error cleaning up terminal ${tabId}:`, err);
                }
            });
        };
    }, []);

    const handleAddTab = () => {
        const newTabId = addTab("~");
        setActive(newTabId);
    };

    const handleRemoveTab = (tabId, e) => {
        e.stopPropagation();

        // Clean up terminal before removing
        try {
            if (terminalRefs.current[tabId]) {
                terminalRefs.current[tabId].dispose();
                delete terminalRefs.current[tabId];
            }
            if (listenersRef.current[tabId]) {
                window.api.removeTerminalListener(tabId);
                delete listenersRef.current[tabId];
            }
            window.api.terminalKill(tabId);
        } catch (err) {
            console.warn(`Error cleaning up terminal ${tabId}:`, err);
        }

        removeTab(tabId);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Tab bar */}
            <div className="flex items-center bg-gray-800/50 border-b border-gray-700/50 px-2 py-1 overflow-x-auto">
                <div className="flex items-center gap-1 flex-1">
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            onClick={() => setActive(tab.id)}
                            className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t cursor-pointer transition-colors ${
                                activeTabId === tab.id
                                    ? "bg-gray-900 text-gray-100 border-t border-x border-gray-700/50"
                                    : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
                            }`}
                        >
                            <VscTerminal className="text-green-400" size={12} />
                            <span className="truncate max-w-[120px]">{tab.title}</span>
                            {tabs.length > 1 && (
                                <button
                                    onClick={(e) => handleRemoveTab(tab.id, e)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all ml-1"
                                >
                                    <VscClose size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddTab}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition"
                    title="New Terminal"
                >
                    <VscAdd size={14} />
                </button>
            </div>

            {/* Terminal containers */}
            <div className="flex-1 relative">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        ref={(el) => {
                            if (el) containerRefs.current[tab.id] = el;
                        }}
                        className={`absolute inset-0 ${
                            activeTabId === tab.id ? "visible" : "invisible"
                        }`}
                        id={`terminal-${tab.id}`}
                    />
                ))}

                {/* Empty state */}
                {tabs.length === 0 && (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <VscTerminal className="mx-auto mb-2 text-4xl opacity-50" />
                            <p className="text-sm">No terminal tabs</p>
                            <button
                                onClick={handleAddTab}
                                className="mt-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                            >
                                Open Terminal
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-gray-800/50 border-t border-gray-700/50 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                    <span>Terminal</span>
                    <span className="text-gray-600">|</span>
                    <span>{tabs.find((t) => t.id === activeTabId)?.cwd || "~"}</span>
                </div>
                <div>
                    {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
                </div>
            </div>
        </div>
    );
}
