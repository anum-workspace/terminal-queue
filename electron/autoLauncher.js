const AutoLaunch = require("auto-launch");
const { app } = require("electron");

function setupAutoLaunch() {
    const autoLauncher = new AutoLaunch({
        name: "TerminalQueue",
        path: app.getPath("exe"),
    });
    autoLauncher.isEnabled().then((enabled) => {
        if (!enabled) autoLauncher.enable();
    });
}
module.exports = { setupAutoLaunch };
