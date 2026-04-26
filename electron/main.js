const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const { setQuitting } = require("./appState");
const { initDatabase } = require("./database");
const { createTray } = require("./tray");
const { setupAutoLaunch } = require("./autoLauncher");

// Import handlers
const { registerQueueHandlers, setTerminals } = require("./ipc/queue");
const { registerHistoryHandlers } = require("./ipc/history");
const { registerCommandsHandlers } = require("./ipc/commands");
const { registerStartupHandlers } = require("./ipc/startup");
const { registerTerminalHandlers, getTerminals } = require("./ipc/terminal");
const { registerWindowHandlers } = require("./ipc/window");
const { registerDialogHandlers } = require("./ipc/dialog");

let mainWindow = null;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        titleBarStyle: "hidden",
        title: "TerminalQueue",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, "../assets/icon.png"),
        backgroundColor: "#030712",
        show: false,
    });

    if (!app.isPackaged) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
        mainWindow.maximize();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.on("close", (e) => {
        if (!require("./appState").getQuitting()) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

app.whenReady().then(async () => {
    // Initialize database FIRST
    await initDatabase();
    console.log("Database initialized");

    // Setup auto launch
    setupAutoLaunch();

    // Create window
    createWindow();

    // Create tray
    tray = createTray(mainWindow);

    // Register ALL IPC handlers - ORDER MATTERS
    console.log("Registering IPC handlers...");

    registerWindowHandlers(mainWindow);
    console.log("✓ Window handlers registered");

    registerDialogHandlers(mainWindow);
    console.log("✓ Dialog handlers registered");

    registerTerminalHandlers(mainWindow);
    console.log("✓ Terminal handlers registered");

    // Share terminals Map with queue handler BEFORE registering queue handlers
    setTerminals(getTerminals());

    registerQueueHandlers(mainWindow);
    console.log("✓ Queue handlers registered");

    registerHistoryHandlers();
    console.log("✓ History handlers registered");

    registerCommandsHandlers();
    console.log("✓ Commands handlers registered");

    registerStartupHandlers();
    console.log("✓ Startup handlers registered");

    console.log("All IPC handlers registered successfully");

    // Global shortcut
    globalShortcut.register("CmdOrCtrl+Shift+T", () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else if (mainWindow) {
        mainWindow.show();
    }
});

app.on("before-quit", () => {
    setQuitting(true);
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});
