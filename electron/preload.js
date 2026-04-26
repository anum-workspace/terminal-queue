const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // ==================== QUEUE OPERATIONS ====================
    getQueue: () => ipcRenderer.invoke("queue:getAll"),
    getQueueById: (id) => ipcRenderer.invoke("queue:getById", id),
    addQueue: (item) => ipcRenderer.invoke("queue:add", item),
    updateQueue: (id, updates) => ipcRenderer.invoke("queue:update", id, updates),
    deleteQueue: (id) => ipcRenderer.invoke("queue:delete", id),
    clearQueue: () => ipcRenderer.invoke("queue:clear"),
    reorderQueue: (ids) => ipcRenderer.invoke("queue:reorder", ids),
    moveQueueItem: (id, direction) => ipcRenderer.invoke("queue:moveItem", id, direction),
    updateQueueStatus: (id, status) => ipcRenderer.invoke("queue:updateStatus", id, status),
    getQueueStats: () => ipcRenderer.invoke("queue:getStats"),
    duplicateQueueItem: (id) => ipcRenderer.invoke("queue:duplicate", id),

    // Queue execution
    runQueue: () => ipcRenderer.invoke("queue:runAll"),
    executeSingleQueue: (item) => ipcRenderer.invoke("queue:executeSingle", item),
    stopQueueExecution: () => ipcRenderer.invoke("queue:stopExecution"),

    // ==================== TERMINAL OPERATIONS ====================
    terminalCreate: (opts) => ipcRenderer.invoke("terminal:create", opts),
    terminalWrite: (tabId, data) => ipcRenderer.invoke("terminal:write", { tabId, data }),
    terminalResize: (tabId, rows, cols) =>
        ipcRenderer.invoke("terminal:resize", { tabId, rows, cols }),
    terminalKill: (tabId) => ipcRenderer.invoke("terminal:kill", { tabId }),
    terminalChangeDir: (tabId, newDir) =>
        ipcRenderer.invoke("terminal:changeDir", { tabId, newDir }),
    terminalGetCwd: (tabId) => ipcRenderer.invoke("terminal:getCwd", { tabId }),
    executeCommand: (item) => ipcRenderer.invoke("terminal:executeCommand", item),
    stopCommand: (queueId) => ipcRenderer.invoke("terminal:stopCommand", queueId),

    // ==================== HISTORY OPERATIONS ====================
    getHistory: () => ipcRenderer.invoke("history:getAll"),
    deleteHistory: (ids) => ipcRenderer.invoke("history:delete", ids),
    clearAllHistory: () => ipcRenderer.invoke("history:clearAll"),
    addToGroup: (historyId, groupName) =>
        ipcRenderer.invoke("history:addToGroup", historyId, groupName),
    retryCommand: (item) => ipcRenderer.invoke("history:retry", item),

    // ==================== COMMANDS OPERATIONS ====================
    getCommands: (group) => ipcRenderer.invoke("commands:getAll", group),
    getCommandGroups: () => ipcRenderer.invoke("commands:getGroups"),
    saveCommand: (cmd) => ipcRenderer.invoke("commands:save", cmd),
    updateCommand: (id, cmd) => ipcRenderer.invoke("commands:update", id, cmd),
    deleteCommand: (id) => ipcRenderer.invoke("commands:delete", id),
    searchCommands: (term) => ipcRenderer.invoke("commands:search", term),
    addCommandGroup: (name) => ipcRenderer.invoke("commands:addGroup", name),
    duplicateCommand: (id) => ipcRenderer.invoke("commands:duplicate", id),

    // ==================== STARTUP OPERATIONS ====================
    getStartup: () => ipcRenderer.invoke("startup:getAll"),
    addStartup: (item) => ipcRenderer.invoke("startup:add", item),
    updateStartup: (id, item) => ipcRenderer.invoke("startup:update", id, item),
    deleteStartup: (id) => ipcRenderer.invoke("startup:delete", id),
    clearStartup: () => ipcRenderer.invoke("startup:clear"),
    reorderStartup: (ids) => ipcRenderer.invoke("startup:reorder", ids),

    // ==================== WINDOW CONTROLS ====================
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    restore: () => ipcRenderer.invoke("window:restore"),
    maximizeOrRestore: () => ipcRenderer.invoke("window:maximizeOrRestore"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),

    // ==================== DIALOG OPERATIONS ====================
    openDirectory: (options) => ipcRenderer.invoke("dialog:openDirectory", options),
    browseAndValidate: (currentPath) => ipcRenderer.invoke("dialog:browseAndValidate", currentPath),
    getDirectoryInfo: (dirPath) => ipcRenderer.invoke("dialog:getDirectoryInfo", dirPath),

    // ==================== EVENT LISTENERS ====================
    onMaximizeChange: (callback) => {
        const handler = (event, isMaximized) => callback(isMaximized);
        ipcRenderer.on("window:maximize-change", handler);
        return () => ipcRenderer.removeListener("window:maximize-change", handler);
    },

    onTerminalData: (tabId, callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(`terminal:data-${tabId}`, handler);
        return () => ipcRenderer.removeListener(`terminal:data-${tabId}`, handler);
    },

    removeTerminalListener: (tabId) => {
        ipcRenderer.removeAllListeners(`terminal:data-${tabId}`);
    },

    onCommandOutput: (queueId, callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(`command:output-${queueId}`, handler);
        return () => ipcRenderer.removeListener(`command:output-${queueId}`, handler);
    },

    onCommandComplete: (queueId, callback) => {
        const handler = (event, result) => callback(result);
        ipcRenderer.on(`command:complete-${queueId}`, handler);
        return () => ipcRenderer.removeListener(`command:complete-${queueId}`, handler);
    },

    onHistoryUpdated: (callback) => {
        const handler = () => callback();
        ipcRenderer.on("history:updated", handler);
        return () => ipcRenderer.removeListener("history:updated", handler);
    },

    // Queue execution events
    onQueueExecutionStarted: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on("queue:execution-started", handler);
        return () => ipcRenderer.removeListener("queue:execution-started", handler);
    },

    onQueueItemRunning: (callback) => {
        const handler = (event, item) => callback(item);
        ipcRenderer.on("queue:item-running", handler);
        return () => ipcRenderer.removeListener("queue:item-running", handler);
    },

    onQueueItemCompleted: (callback) => {
        const handler = (event, item) => callback(item);
        ipcRenderer.on("queue:item-completed", handler);
        return () => ipcRenderer.removeListener("queue:item-completed", handler);
    },

    onQueueItemFailed: (callback) => {
        const handler = (event, item) => callback(item);
        ipcRenderer.on("queue:item-failed", handler);
        return () => ipcRenderer.removeListener("queue:item-failed", handler);
    },

    onQueueExecutionCompleted: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on("queue:execution-completed", handler);
        return () => ipcRenderer.removeListener("queue:execution-completed", handler);
    },

    onQueueItemStopped: (callback) => {
        const handler = (event, item) => callback(item);
        ipcRenderer.on("queue:item-stopped", handler);
        return () => ipcRenderer.removeListener("queue:item-stopped", handler);
    },

    onQueueStopping: (callback) => {
        const handler = () => callback();
        ipcRenderer.on("queue:stopping", handler);
        return () => ipcRenderer.removeListener("queue:stopping", handler);
    },
});
