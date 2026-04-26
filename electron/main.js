const { app } = require("electron");
const { createWindow } = require("./core/windowManager");
const { createTray } = require("./core/systemTray");
const { initDB } = require("./services/dbService");
const { registerIpc } = require("./ipc/appIpc");
const AutoLaunch = require("auto-launch");
const { setQuitting } = require("./core/appState");

const launcher = new AutoLaunch({
    name: "TerminalQueue",
});

app.whenReady().then(async () => {
    await initDB();

    createWindow();
    createTray();

    registerIpc();

    launcher.enable().catch(() => {});

    app.on("activate", () => {
        createWindow();
    });
});

app.on("before-quit", () => {
    setQuitting(true);
});

app.on("window-all-closed", (event) => {
    event.preventDefault();
});
