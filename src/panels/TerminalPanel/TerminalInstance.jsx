import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

export default function TerminalInstance({ tab }) {
    const ref = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);

    // ✅ Create terminal ONLY once per session
    useEffect(() => {
        if (!tab?.sessionId || !ref.current) return;

        const term = new Terminal({
            cursorBlink: true,
            convertEol: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono','Fira Code','Cascadia Mono',monospace",
            lineHeight: 1.25,
            scrollback: 5000,
            theme: {
                background: "#030712",
                foreground: "#d1d5db",
                cursor: "#f9fafb",
            },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(ref.current);

        termRef.current = term;
        fitRef.current = fitAddon;

        // ✅ SAFE FIT (fixes dimensions error)
        const safeFit = () => {
            if (!ref.current || !term.element) return;

            const rect = ref.current.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) return;

            try {
                fitAddon.fit();
                window.api.terminal.resize(tab.sessionId, term.cols, term.rows);
            } catch {}
        };

        // Initial fit
        setTimeout(safeFit, 0);

        term.writeln("Terminal is Ready 🚀");

        const inputDisposable = term.onData((data) => {
            window.api.terminal.write(tab.sessionId, data);
        });

        // ✅ Resize observer (safe)
        const resizeObserver = new ResizeObserver(() => {
            safeFit();
        });

        resizeObserver.observe(ref.current);

        return () => {
            inputDisposable.dispose();
            resizeObserver.disconnect();
            term.dispose();
        };
    }, [tab.sessionId]);

    // ✅ Handle output separately (NO re-create)
    useEffect(() => {
        if (termRef.current && tab?.buffer) {
            termRef.current.write(tab.buffer);
        }
    }, [tab.buffer]);

    return (
        <div
            ref={ref}
            className="h-full w-full rounded-md border border-gray-800 bg-gray-950"
            style={{ minHeight: "200px" }}
        />
    );
}
