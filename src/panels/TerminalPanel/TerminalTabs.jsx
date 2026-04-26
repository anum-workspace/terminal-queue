import React, { useEffect, useRef } from "react";
import { VscChromeClose } from "react-icons/vsc";
import { useTerminalStore } from "../../store/terminalStore";
import TerminalInstance from "./TerminalInstance";

export default function TerminalTabs() {
    const tabs = useTerminalStore((s) => s.tabs);
    const active = useTerminalStore((s) => s.active);

    const initialize = useTerminalStore((s) => s.initialize);
    const recreateDefault = useTerminalStore((s) => s.recreateDefault);
    const registerSession = useTerminalStore((s) => s.registerSession);
    const setActive = useTerminalStore((s) => s.setActive);
    const appendOutput = useTerminalStore((s) => s.appendOutput);
    const closeTab = useTerminalStore((s) => s.closeTab);
    const removeTab = useTerminalStore((s) => s.removeTab);

    // ✅ StrictMode-safe init
    const didInit = useRef(false);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const offCreated = window.api.terminal.onCreated(registerSession);
        const offJobSession = window.api.terminal.onJobSession(registerSession);

        const offOutput = window.api.terminal.onOutput(({ sessionId, data }) => {
            appendOutput(sessionId, data);
        });

        const offExit = window.api.terminal.onExit(({ sessionId, persistent, autoClose }) => {
            if (persistent) {
                recreateDefault();
                return;
            }

            // ✅ Delay close (better UX)
            if (!persistent && autoClose) {
                setTimeout(() => {
                    removeTab(sessionId);
                }, 3000);
            }
        });

        initialize();

        return () => {
            offCreated?.();
            offJobSession?.();
            offOutput?.();
            offExit?.();
        };
    }, []);

    const activeTab = tabs.find((t) => t.sessionId === active) || tabs[0] || null;

    return (
        <div className="flex h-full min-h-0 flex-col bg-gray-950/60">
            {/* Tabs */}
            <div className="flex items-center border-b border-gray-800 bg-gray-900/80">
                {tabs.map((tab) => (
                    <div
                        key={tab.sessionId}
                        className={`flex items-center gap-2 border-r border-gray-800 px-3 py-2 text-sm ${
                            active === tab.sessionId
                                ? "bg-gray-800 text-gray-100"
                                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                        }`}
                    >
                        <button
                            onClick={() => setActive(tab.sessionId)}
                            className="max-w-40 truncate text-left"
                        >
                            {tab.name}
                        </button>

                        {!tab.persistent && (
                            <button
                                onClick={() => closeTab(tab.sessionId)}
                                className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-100"
                            >
                                <VscChromeClose />
                            </button>
                        )}
                    </div>
                ))}

                {/* ✅ New Tab Button */}
                <button
                    onClick={async () => {
                        const home = await window.api.system.home();
                        await window.api.terminal.create({
                            cwd: home,
                            name: "Terminal",
                            persistent: false,
                            autoClose: false,
                        });
                    }}
                    className="ml-auto px-3 text-sm text-gray-400 hover:text-white"
                >
                    + New Tab
                </button>
            </div>

            {/* Terminal */}
            <div className="flex h-full flex-1">
                {activeTab && (
                    <TerminalInstance
                        key={activeTab.sessionId} // ✅ prevents remount storm
                        tab={activeTab}
                    />
                )}
            </div>
        </div>
    );
}
