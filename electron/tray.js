const { Tray, Menu, app, nativeImage } = require("electron");
const path = require("path");

function createTray(mainWindow) {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/icon.png"));
    const tray = new Tray(icon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show App",
            click: () => {
                mainWindow.show();
                mainWindow.focus();
            },
        },
        {
            label: "Quit",
            click: () => {
                app.isQuitting = true;
                app.quit();
            },
        },
    ]);
    tray.setToolTip("TerminalQueue");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
    return tray;
}
module.exports = { createTray };
