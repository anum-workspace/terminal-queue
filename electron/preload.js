const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // Queue operations
    getQueue: () => ipcRenderer.invoke("queue:getAll"),
    addQueue: (item) => ipcRenderer.invoke("queue:add", item),
    updateQueue: (id, updates) => ipcRenderer.invoke("queue:update", id, updates),
    deleteQueue: (id) => ipcRenderer.invoke("queue:delete", id),
    clearQueue: () => ipcRenderer.invoke("queue:clear"),
    reorderQueue: (ids) => ipcRenderer.invoke("queue:reorder", ids),
    moveQueueItem: (id, direction) => ipcRenderer.invoke("queue:moveItem", id, direction),
    updateQueueStatus: (id, status) => ipcRenderer.invoke("queue:updateStatus", id, status),
    getQueueStats: () => ipcRenderer.invoke("queue:getStats"),
    duplicateQueueItem: (id) => ipcRenderer.invoke("queue:duplicate", id),
    executeCommand: (item) => ipcRenderer.invoke("terminal:executeCommand", item),
    stopCommand: (id) => ipcRenderer.invoke("terminal:stopCommand", id),
    runQueue: () => ipcRenderer.invoke("queue:runAll"),
    stopQueueExecution: () => ipcRenderer.invoke("queue:stopExecution"),

    // History
    getHistory: () => ipcRenderer.invoke("history:getAll"),
    deleteHistory: (ids) => ipcRenderer.invoke("history:delete", ids),
    addToGroup: (id, group) => ipcRenderer.invoke("history:addToGroup", id, group),
    onHistoryUpdated: (callback) => {
        const handler = () => {
            try {
                callback();
            } catch (err) {
                console.error("Error in history update callback:", err);
            }
        };
        ipcRenderer.on("history:updated", handler);
        return () => {
            ipcRenderer.removeListener("history:updated", handler);
        };
    },

    // Commands
    getCommands: (group) => ipcRenderer.invoke("commands:getAll", group),
    saveCommand: (cmd) => ipcRenderer.invoke("commands:save", cmd),
    updateCommand: (cmd) => ipcRenderer.invoke("commands:update", cmd),
    deleteCommand: (id) => ipcRenderer.invoke("commands:delete", id),
    getCommandGroups: () => ipcRenderer.invoke("commands:getGroups"),
    addCommandGroup: (groupName) => ipcRenderer.invoke("commands:addGroup", groupName),

    // Startup
    getStartup: () => ipcRenderer.invoke("startup:getAll"),
    addStartup: (item) => ipcRenderer.invoke("startup:add", item),
    updateStartup: (item) => ipcRenderer.invoke("startup:update", item),
    deleteStartup: (id) => ipcRenderer.invoke("startup:delete", id),
    clearStartup: () => ipcRenderer.invoke("startup:clear"),

    // Terminal operations
    terminalCreate: (opts) => ipcRenderer.invoke("terminal:create", opts),
    terminalWrite: (tabId, data) => ipcRenderer.invoke("terminal:write", { tabId, data }),
    terminalResize: (tabId, rows, cols) =>
        ipcRenderer.invoke("terminal:resize", { tabId, rows, cols }),
    terminalKill: (tabId) => ipcRenderer.invoke("terminal:kill", { tabId }),
    terminalChangeDir: (tabId, newDir) =>
        ipcRenderer.invoke("terminal:changeDir", { tabId, newDir }),
    terminalGetCwd: (tabId) => ipcRenderer.invoke("terminal:getCwd", { tabId }),

    // Command execution
    executeCommand: (queueItem) => ipcRenderer.invoke("terminal:executeCommand", queueItem),
    stopCommand: (queueId) => ipcRenderer.invoke("terminal:stopCommand", queueId),
    executeQueue: () => ipcRenderer.invoke("terminal:executeQueue"),
    getCommandStatus: (queueId) => ipcRenderer.invoke("terminal:getCommandStatus", queueId),

    // Terminal data events
    onTerminalData: (tabId, callback) => {
        const handler = (event, data) => {
            try {
                callback(data);
            } catch (err) {
                console.error("Error in terminal data callback:", err);
            }
        };
        ipcRenderer.on(`terminal:data-${tabId}`, handler);
        // Return cleanup function
        return () => {
            ipcRenderer.removeListener(`terminal:data-${tabId}`, handler);
        };
    },

    removeTerminalListener: (tabId) => {
        ipcRenderer.removeAllListeners(`terminal:data-${tabId}`);
    },

    onTerminalExit: (tabId, callback) => {
        const handler = (event, exitCode) => {
            try {
                callback(exitCode);
            } catch (err) {
                console.error("Error in terminal exit callback:", err);
            }
        };
        ipcRenderer.on(`terminal:exit-${tabId}`, handler);
        return () => {
            ipcRenderer.removeListener(`terminal:exit-${tabId}`, handler);
        };
    },

    // Command execution events
    onCommandOutput: (queueId, callback) => {
        const handler = (event, data) => {
            try {
                callback(data);
            } catch (err) {
                console.error("Error in command output callback:", err);
            }
        };
        ipcRenderer.on(`command:output-${queueId}`, handler);
        return () => {
            ipcRenderer.removeListener(`command:output-${queueId}`, handler);
        };
    },

    onCommandComplete: (queueId, callback) => {
        const handler = (event, result) => {
            try {
                callback(result);
            } catch (err) {
                console.error("Error in command complete callback:", err);
            }
        };
        ipcRenderer.on(`command:complete-${queueId}`, handler);
        return () => {
            ipcRenderer.removeListener(`command:complete-${queueId}`, handler);
        };
    },

    // Queue execution events
    onQueueExecutionStarted: (callback) => {
        const handler = (event, data) => {
            try {
                callback(data);
            } catch (err) {
                console.error("Error in queue execution callback:", err);
            }
        };
        ipcRenderer.on("queue:execution-started", handler);
        return () => {
            ipcRenderer.removeListener("queue:execution-started", handler);
        };
    },

    onQueueItemRunning: (callback) => {
        const handler = (event, item) => {
            try {
                callback(item);
            } catch (err) {
                console.error("Error in queue item running callback:", err);
            }
        };
        ipcRenderer.on("queue:item-running", handler);
        return () => {
            ipcRenderer.removeListener("queue:item-running", handler);
        };
    },

    onQueueItemCompleted: (callback) => {
        const handler = (event, item) => {
            try {
                callback(item);
            } catch (err) {
                console.error("Error in queue item completed callback:", err);
            }
        };
        ipcRenderer.on("queue:item-completed", handler);
        return () => {
            ipcRenderer.removeListener("queue:item-completed", handler);
        };
    },

    onQueueItemFailed: (callback) => {
        const handler = (event, item) => {
            try {
                callback(item);
            } catch (err) {
                console.error("Error in queue item failed callback:", err);
            }
        };
        ipcRenderer.on("queue:item-failed", handler);
        return () => {
            ipcRenderer.removeListener("queue:item-failed", handler);
        };
    },

    onQueueExecutionCompleted: (callback) => {
        const handler = (event, data) => {
            try {
                callback(data);
            } catch (err) {
                console.error("Error in queue execution completed callback:", err);
            }
        };
        ipcRenderer.on("queue:execution-completed", handler);
        return () => {
            ipcRenderer.removeListener("queue:execution-completed", handler);
        };
    },

    // Window controls
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    restore: () => ipcRenderer.invoke("window:restore"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (callback) => {
        ipcRenderer.on("window:maximize-change", (event, isMaximized) => callback(isMaximized));
    },

    // Dialog operations
    openDirectory: (options) => ipcRenderer.invoke("dialog:openDirectory", options),
    openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
    getDirectoryInfo: (dirPath) => ipcRenderer.invoke("dialog:getDirectoryInfo", dirPath),
    browseAndValidate: (currentPath) => ipcRenderer.invoke("dialog:browseAndValidate", currentPath),
});
