// core/windowManager.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = !app.isPackaged;
const { getQuitting } = require("./appState");

let win;

function createWindow() {
    if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        return win;
    }

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        icon: path.join(__dirname, "../assets/icon.png"),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "../preload.js"),
        },
    });

    if (isDev) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools();
        win.maximize();
    } else {
        win.setMenu(null);
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    win.on("close", (e) => {
        if (!getQuitting()) {
            e.preventDefault();
            win.hide();
        }
    });

    win.on("closed", () => {
        win = null;
    });

    return win;
}

function getWindow() {
    return win;
}

module.exports = { createWindow, getWindow };
