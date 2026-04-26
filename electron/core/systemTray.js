const { Tray, Menu, app } = require("electron");
const path = require("path");
const { getWindow } = require("./windowManager");

let tray;

function createTray() {
    if (tray) {
        return tray;
    }

    tray = new Tray(path.join(__dirname, "../assets/icon.png"));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show",
            click: () => getWindow().show(),
        },
        {
            label: "Quit",
            click: () => app.quit(),
        },
    ]);

    tray.setToolTip("TerminalQueue");
    tray.setContextMenu(contextMenu);

    tray.on("double-click", () => {
        getWindow()?.show();
    });

    return tray;
}

module.exports = { createTray };
