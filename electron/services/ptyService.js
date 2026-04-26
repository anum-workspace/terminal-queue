const pty = require("node-pty");

const sessions = new Map();
let eventHandler = () => {};

function setEventHandler(handler) {
    eventHandler = typeof handler === "function" ? handler : () => {};
}

function resolveCwd(cwd) {
    const home = process.env.HOME || "/";

    if (!cwd || cwd === "~") {
        return home;
    }

    if (cwd.startsWith("~/")) {
        return `${home}/${cwd.slice(2)}`;
    }

    return cwd;
}

function buildSessionName({ name, cwd, persistent }) {
    if (name) {
        return name;
    }

    return persistent
        ? "Terminal"
        : (cwd || process.env.HOME || "/").split("/").filter(Boolean).pop() || "Terminal";
}

function emit(type, payload) {
    eventHandler(type, payload);
}

function createSession(options = {}) {
    const sessionId = options.id || `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cwd = resolveCwd(options.cwd);
    const persistent = Boolean(options.persistent);

    const proc = pty.spawn("bash", ["--login"], {
        name: "xterm-color",
        cols: options.cols || 120,
        rows: options.rows || 36,
        cwd,
        env: {
            ...process.env,
            TERM: "xterm-256color",
        },
    });

    const session = {
        id: sessionId,
        proc,
        cwd,
        persistent,
        autoClose: options.autoClose !== false,
        name: buildSessionName({ name: options.name, cwd, persistent }),
    };

    sessions.set(sessionId, session);

    proc.onData((data) => {
        emit("data", { sessionId, data });
    });

    proc.onExit((exitCode, signal) => {
        emit("exit", {
            sessionId,
            exitCode,
            signal,
            persistent: session.persistent,
            autoClose: session.autoClose,
        });

        sessions.delete(sessionId);
    });

    emit("created", {
        sessionId,
        name: session.name,
        cwd: session.cwd,
        persistent: session.persistent,
        autoClose: session.autoClose,
    });

    return {
        sessionId,
        cwd: session.cwd,
        name: session.name,
        persistent: session.persistent,
        autoClose: session.autoClose,
    };
}

function listSessions() {
    return [...sessions.values()].map((session) => ({
        sessionId: session.id,
        name: session.name,
        cwd: session.cwd,
        persistent: session.persistent,
        autoClose: session.autoClose,
    }));
}

function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

function writeToSession(sessionId, data) {
    const session = getSession(sessionId);

    if (!session) {
        return false;
    }

    session.proc.write(data);
    return true;
}

function resizeSession(sessionId, cols, rows) {
    const session = getSession(sessionId);

    if (!session) {
        return false;
    }

    session.proc.resize(Math.max(2, cols), Math.max(2, rows));
    return true;
}

function closeSession(sessionId) {
    const session = getSession(sessionId);

    if (!session) {
        return false;
    }

    session.proc.kill();
    return true;
}

function revealDirectory(sessionId, cwd, previewText = "") {
    const session = getSession(sessionId);

    if (!session) {
        return false;
    }

    const nextCwd = resolveCwd(cwd);
    session.cwd = nextCwd;
    session.proc.write(`cd ${JSON.stringify(nextCwd)}\r`);

    if (previewText && String(previewText).trim()) {
        const preview = String(previewText).replace(/\n/g, "\n> ");
        session.proc.write(
            `printf '\\nCommand will be executed here:\\n> ${preview.replace(/'/g, "'\\''")}\\n\\n'\r`,
        );
    }

    return true;
}

module.exports = {
    setEventHandler,
    createSession,
    listSessions,
    getSession,
    writeToSession,
    resizeSession,
    closeSession,
    revealDirectory,
    resolveCwd,
};
