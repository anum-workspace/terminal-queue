const { app, dialog, ipcMain, BrowserWindow } = require("electron");
const queueService = require("../services/queueService");
const db = require("../services/dbService");
const ptyService = require("../services/ptyService");

function getMainWindow() {
    return BrowserWindow.getAllWindows()[0];
}

function emit(channel, payload) {
    const win = getMainWindow();

    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
    }
}

function createExecutionHelpers() {
    const listeners = new Map();

    return {
        onSession(session) {
            emit("terminal:job-session", session);
        },
        subscribe(sessionId, callback) {
            const listener = (payload) => {
                if (payload.sessionId === sessionId) {
                    callback(payload.data);
                }
            };

            listeners.set(sessionId, listener);
            return () => listeners.delete(sessionId);
        },
        forward(type, payload) {
            if (type === "data") {
                listeners.get(payload.sessionId)?.(payload);
                emit("terminal:data", payload);
                return;
            }

            if (type === "exit") {
                emit("terminal:exit", payload);
                return;
            }

            if (type === "created") {
                emit("terminal:created", payload);
            }
        },
    };
}

function registerIpc() {
    const executionHelpers = createExecutionHelpers();
    ptyService.setEventHandler((type, payload) => executionHelpers.forward(type, payload));

    ipcMain.handle("queue:list", () => db.listQueue());
    ipcMain.handle("queue:create", (_, payload) => db.createQueueItem(payload));
    ipcMain.handle("queue:update", (_, id, payload) => db.updateQueueItem(id, payload));
    ipcMain.handle("queue:delete", (_, id) => db.deleteQueueItem(id));
    ipcMain.handle("queue:clear", () => db.clearQueue());
    ipcMain.handle("queue:run", () => queueService.runQueue(executionHelpers));

    ipcMain.handle("startup:list", () => db.listStartup());
    ipcMain.handle("startup:create", (_, payload) => db.createStartupItem(payload));
    ipcMain.handle("startup:update", (_, id, payload) => db.updateStartupItem(id, payload));
    ipcMain.handle("startup:delete", (_, id) => db.deleteStartupItem(id));
    ipcMain.handle("startup:clear", () => db.clearStartup());
    ipcMain.handle("startup:run", () => queueService.runStartup(executionHelpers));

    ipcMain.handle("history:list", () => db.listHistory());
    ipcMain.handle("history:delete", (_, id) => db.deleteHistory(id));
    ipcMain.handle("history:clear", () => db.clearHistory());

    ipcMain.handle("commands:list", (_, groupName) => db.listCommands(groupName));
    ipcMain.handle("commands:groups", () => db.listCommandGroups());
    ipcMain.handle("commands:save", (_, payload) => db.saveCommand(payload));
    ipcMain.handle("commands:delete", (_, id) => db.deleteCommand(id));

    ipcMain.handle("system:home", () => app.getPath("home"));
    ipcMain.handle("dialog:open-directory", async (_, defaultPath) => {
        const result = await dialog.showOpenDialog(getMainWindow(), {
            defaultPath: defaultPath || app.getPath("home"),
            properties: ["openDirectory"],
        });

        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle("terminal:create", (_, payload) => ptyService.createSession(payload));
    ipcMain.handle("terminal:list", () => ptyService.listSessions());
    ipcMain.handle("terminal:write", (_, sessionId, data) =>
        ptyService.writeToSession(sessionId, data),
    );
    ipcMain.handle("terminal:resize", (_, sessionId, cols, rows) =>
        ptyService.resizeSession(sessionId, cols, rows),
    );
    ipcMain.handle("terminal:close", (_, sessionId) => ptyService.closeSession(sessionId));
    ipcMain.handle("terminal:reveal-directory", (_, sessionId, cwd, previewText) =>
        ptyService.revealDirectory(sessionId, cwd, previewText),
    );
    ipcMain.handle("terminal:execute", (_, job) => queueService.executeNow(job, executionHelpers));
    ipcMain.handle("terminal:state", () => queueService.getState());
    ipcMain.handle("terminal:stop", (_, sessionId) => queueService.stop(sessionId));

    ipcMain.on("win:min", () => {
        getMainWindow()?.minimize();
    });

    ipcMain.on("win:max", () => {
        const win = getMainWindow();

        if (!win) {
            return;
        }

        win.isMaximized() ? win.unmaximize() : win.maximize();
    });

    ipcMain.on("win:close", () => {
        getMainWindow()?.close();
    });
}

module.exports = { registerIpc };
