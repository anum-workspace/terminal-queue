const { ipcMain, dialog } = require("electron");
const os = require("os");

function registerDialogHandlers(mainWindow) {
    // Open directory picker dialog
    ipcMain.handle("dialog:openDirectory", async (event, options = {}) => {
        try {
            const defaultPath = options.defaultPath || os.homedir();

            const result = await dialog.showOpenDialog(mainWindow, {
                title: options.title || "Select Directory",
                defaultPath: defaultPath,
                properties: ["openDirectory", "createDirectory"],
                buttonLabel: options.buttonLabel || "Select Directory",
            });

            if (result.canceled || result.filePaths.length === 0) {
                return {
                    canceled: true,
                    path: null,
                };
            }

            const selectedPath = result.filePaths[0];

            // Optionally convert to relative path with ~ for home directory
            let displayPath = selectedPath;
            const homeDir = os.homedir();
            if (selectedPath.startsWith(homeDir)) {
                displayPath = "~" + selectedPath.substring(homeDir.length);
            }

            return {
                canceled: false,
                path: selectedPath,
                displayPath: displayPath,
            };
        } catch (error) {
            console.error("Error opening directory dialog:", error);
            return {
                canceled: true,
                path: null,
                error: error.message,
            };
        }
    });

    // Open file picker dialog (useful for selecting specific files)
    ipcMain.handle("dialog:openFile", async (event, options = {}) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: options.title || "Select File",
                defaultPath: options.defaultPath || os.homedir(),
                filters: options.filters || [{ name: "All Files", extensions: ["*"] }],
                properties: ["openFile"],
                buttonLabel: options.buttonLabel || "Select File",
            });

            if (result.canceled || result.filePaths.length === 0) {
                return {
                    canceled: true,
                    path: null,
                };
            }

            return {
                canceled: false,
                path: result.filePaths[0],
            };
        } catch (error) {
            console.error("Error opening file dialog:", error);
            return {
                canceled: true,
                path: null,
                error: error.message,
            };
        }
    });

    // Get directory info (exists, is writable, etc.)
    ipcMain.handle("dialog:getDirectoryInfo", async (event, dirPath) => {
        const fs = require("fs");
        const path = require("path");
        const homeDir = os.homedir();

        try {
            const resolvedPath = dirPath.replace(/^~/, homeDir);

            if (!fs.existsSync(resolvedPath)) {
                return {
                    exists: false,
                    path: resolvedPath,
                    error: "Directory does not exist",
                };
            }

            const stats = fs.statSync(resolvedPath);

            if (!stats.isDirectory()) {
                return {
                    exists: true,
                    isDirectory: false,
                    path: resolvedPath,
                    error: "Path is not a directory",
                };
            }

            // Check if writable
            try {
                fs.accessSync(resolvedPath, fs.constants.W_OK);
                var isWritable = true;
            } catch (err) {
                var isWritable = false;
            }

            // Get directory contents count
            const files = fs.readdirSync(resolvedPath);

            return {
                exists: true,
                isDirectory: true,
                isWritable,
                path: resolvedPath,
                displayPath: dirPath,
                parentDir: path.dirname(resolvedPath),
                dirname: path.basename(resolvedPath),
                fileCount: files.length,
                size: stats.size,
                modified: stats.mtime,
            };
        } catch (error) {
            console.error("Error getting directory info:", error);
            return {
                exists: false,
                path: dirPath,
                error: error.message,
            };
        }
    });

    // Browse to and validate directory
    ipcMain.handle("dialog:browseAndValidate", async (event, currentPath) => {
        const homeDir = os.homedir();
        const defaultPath = currentPath ? currentPath.replace(/^~/, homeDir) : homeDir;

        const result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Working Directory",
            defaultPath: defaultPath,
            properties: ["openDirectory", "createDirectory"],
            buttonLabel: "Select Directory",
        });

        if (result.canceled || result.filePaths.length === 0) {
            return {
                canceled: true,
                path: currentPath || "~",
            };
        }

        const selectedPath = result.filePaths[0];
        const fs = require("fs");

        // Validate directory
        try {
            if (!fs.existsSync(selectedPath)) {
                return {
                    canceled: false,
                    path: currentPath,
                    error: "Selected directory does not exist",
                    valid: false,
                };
            }

            const stats = fs.statSync(selectedPath);
            if (!stats.isDirectory()) {
                return {
                    canceled: false,
                    path: currentPath,
                    error: "Selected path is not a directory",
                    valid: false,
                };
            }

            // Create display path with ~ for home
            let displayPath = selectedPath;
            if (selectedPath.startsWith(homeDir)) {
                displayPath = "~" + selectedPath.substring(homeDir.length);
            }

            return {
                canceled: false,
                path: selectedPath,
                displayPath: displayPath,
                valid: true,
                exists: true,
                isDirectory: true,
            };
        } catch (error) {
            return {
                canceled: false,
                path: currentPath,
                error: error.message,
                valid: false,
            };
        }
    });
}

module.exports = { registerDialogHandlers };
