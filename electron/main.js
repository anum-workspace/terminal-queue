const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const { setQuitting } = require("./appState");
const { initDatabase } = require("./database");
const { createTray } = require("./tray");
const { setupAutoLaunch } = require("./autoLauncher");
const { registerQueueHandlers } = require("./ipc/queue");
const { registerHistoryHandlers } = require("./ipc/history.js");
const { registerCommandsHandlers } = require("./ipc/commands.js");
const { registerStartupHandlers } = require("./ipc/startup");
const { registerTerminalHandlers } = require("./ipc/terminal");
const { registerWindowHandlers } = require("./ipc/window");
const { registerSystemHandlers } = require("./ipc/system");
const { registerDialogHandlers } = require("./ipc/dialog");

let mainWindow = null;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Custom titlebar
        titleBarStyle: "hidden",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, "../assets/icon.png"),
    });

    // Load Vite dev server or built files
    if (!app.isPackaged) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
        mainWindow.maximize();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    mainWindow.on("close", (e) => {
        if (!require("./appState").getQuitting()) {
            e.preventDefault();
            mainWindow.hide(); // Minimize to tray
        }
    });
}

app.whenReady().then(async () => {
    await initDatabase(); // Create tables
    setupAutoLaunch();
    createWindow();
    tray = createTray(mainWindow);

    // Register all IPC handlers
    registerQueueHandlers(mainWindow);
    registerHistoryHandlers();
    registerCommandsHandlers();
    registerStartupHandlers();
    registerTerminalHandlers(mainWindow);
    registerWindowHandlers(mainWindow);
    registerSystemHandlers();
    registerDialogHandlers(mainWindow);
    // Global shortcut to show window (optional)
    globalShortcut.register("CmdOrCtrl+Shift+T", () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    setQuitting(true);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
