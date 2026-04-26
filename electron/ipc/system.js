const { ipcMain } = require("electron");
const os = require("os");

function registerSystemHandlers() {
    ipcMain.handle("system:getInfo", () => {
        return {
            username: os.userInfo().username,
            hostname: os.hostname(),
            homedir: os.homedir(),
            platform: os.platform(),
            shell:
                process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "/bin/bash"),
        };
    });
}

module.exports = { registerSystemHandlers };
