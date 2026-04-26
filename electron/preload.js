const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on(channel, handler);

    return () => {
        ipcRenderer.removeListener(channel, handler);
    };
}

contextBridge.exposeInMainWorld("api", {
    queue: {
        list: () => ipcRenderer.invoke("queue:list"),
        create: (payload) => ipcRenderer.invoke("queue:create", payload),
        update: (id, payload) => ipcRenderer.invoke("queue:update", id, payload),
        delete: (id) => ipcRenderer.invoke("queue:delete", id),
        clear: () => ipcRenderer.invoke("queue:clear"),
        run: () => ipcRenderer.invoke("queue:run"),
    },
    startup: {
        list: () => ipcRenderer.invoke("startup:list"),
        create: (payload) => ipcRenderer.invoke("startup:create", payload),
        update: (id, payload) => ipcRenderer.invoke("startup:update", id, payload),
        delete: (id) => ipcRenderer.invoke("startup:delete", id),
        clear: () => ipcRenderer.invoke("startup:clear"),
        run: () => ipcRenderer.invoke("startup:run"),
    },
    history: {
        list: () => ipcRenderer.invoke("history:list"),
        delete: (id) => ipcRenderer.invoke("history:delete", id),
        clear: () => ipcRenderer.invoke("history:clear"),
    },
    commands: {
        list: (groupName) => ipcRenderer.invoke("commands:list", groupName),
        groups: () => ipcRenderer.invoke("commands:groups"),
        save: (payload) => ipcRenderer.invoke("commands:save", payload),
        delete: (id) => ipcRenderer.invoke("commands:delete", id),
    },
    system: {
        home: () => ipcRenderer.invoke("system:home"),
        openDirectory: (defaultPath) => ipcRenderer.invoke("dialog:open-directory", defaultPath),
    },
    terminal: {
        create: (payload) => ipcRenderer.invoke("terminal:create", payload),
        list: () => ipcRenderer.invoke("terminal:list"),
        write: (sessionId, data) => ipcRenderer.invoke("terminal:write", sessionId, data),
        resize: (sessionId, cols, rows) =>
            ipcRenderer.invoke("terminal:resize", sessionId, cols, rows),
        close: (sessionId) => ipcRenderer.invoke("terminal:close", sessionId),
        revealDirectory: (sessionId, cwd, previewText) =>
            ipcRenderer.invoke("terminal:reveal-directory", sessionId, cwd, previewText),
        execute: (payload) => ipcRenderer.invoke("terminal:execute", payload),
        stop: (sessionId) => ipcRenderer.invoke("terminal:stop", sessionId),
        state: () => ipcRenderer.invoke("terminal:state"),
        onOutput: (callback) => subscribe("terminal:data", callback),
        onExit: (callback) => subscribe("terminal:exit", callback),
        onCreated: (callback) => subscribe("terminal:created", callback),
        onJobSession: (callback) => subscribe("terminal:job-session", callback),
    },
    window: {
        minimize: () => ipcRenderer.send("win:min"),
        maximize: () => ipcRenderer.send("win:max"),
        close: () => ipcRenderer.send("win:close"),
    },
});
