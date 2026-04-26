import React, { useState } from "react";
import {
    VscChromeClose,
    VscChromeMaximize,
    VscChromeMinimize,
    VscChromeRestore,
    VscTerminal,
} from "react-icons/vsc";

export default function Navbar() {
    const [maximized, setMaximized] = useState(true);
    function handleMaximize() {
        window.api.window.maximize();
        setMaximized(!maximized);
    }
    return (
        <div
            className="flex h-8 items-center justify-between border-b border-gray-800 bg-gray-900/95 px-3 py-1"
            style={{ WebkitAppRegion: "drag" }}
        >
            <div className="flex items-center gap-2">
                <VscTerminal className="text-lg text-gray-300" />
                <span className="font-semibold text-gray-200">Terminal Queue</span>
            </div>

            <div
                className="flex items-center -mr-3 text-base text-gray-400"
                style={{ WebkitAppRegion: "no-drag" }}
            >
                <button
                    type="button"
                    onClick={() => window.api.window.minimize()}
                    className="px-3 py-2 hover:bg-gray-800 hover:text-gray-100"
                >
                    <VscChromeMinimize />
                </button>
                <button
                    type="button"
                    onClick={handleMaximize}
                    className="px-3 py-2 hover:bg-gray-800 hover:text-gray-100"
                >
                    {maximized ? <VscChromeRestore /> : <VscChromeMaximize />}
                </button>
                <button
                    type="button"
                    onClick={() => window.api.window.close()}
                    className="px-3 py-2 hover:bg-gray-800 hover:text-red-300"
                >
                    <VscChromeClose />
                </button>
            </div>
        </div>
    );
}
