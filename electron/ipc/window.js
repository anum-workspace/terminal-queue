const { ipcMain, BrowserWindow } = require("electron");

function registerWindowHandlers(mainWindow) {
    // Minimize window
    ipcMain.handle("window:minimize", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Maximize window
    ipcMain.handle("window:maximize", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.maximize();
            return { success: true, isMaximized: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Restore window (unmaximize)
    ipcMain.handle("window:restore", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.unmaximize();
            return { success: true, isMaximized: false };
        }
        return { success: false, error: "Window not available" };
    });

    // Toggle maximize/restore
    ipcMain.handle("window:maximizeOrRestore", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
                return { success: true, isMaximized: false };
            } else {
                mainWindow.maximize();
                return { success: true, isMaximized: true };
            }
        }
        return { success: false, error: "Window not available" };
    });

    // Close window
    ipcMain.handle("window:close", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            // Instead of quitting, hide to system tray
            mainWindow.hide();
            return { success: true, hidden: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Check if window is maximized
    ipcMain.handle("window:isMaximized", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.isMaximized();
        }
        return false;
    });

    // Check if window is minimized
    ipcMain.handle("window:isMinimized", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.isMinimized();
        }
        return false;
    });

    // Check if window is visible
    ipcMain.handle("window:isVisible", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.isVisible();
        }
        return false;
    });

    // Show window
    ipcMain.handle("window:show", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Hide window
    ipcMain.handle("window:hide", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.hide();
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Toggle window visibility
    ipcMain.handle("window:toggleVisibility", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
                return { success: true, visible: false };
            } else {
                mainWindow.show();
                mainWindow.focus();
                return { success: true, visible: true };
            }
        }
        return { success: false, error: "Window not available" };
    });

    // Listen for maximize/unmaximize events to notify renderer
    if (mainWindow) {
        mainWindow.on("maximize", () => {
            mainWindow.webContents.send("window:maximize-change", true);
        });

        mainWindow.on("unmaximize", () => {
            mainWindow.webContents.send("window:maximize-change", false);
        });

        mainWindow.on("minimize", () => {
            mainWindow.webContents.send("window:minimize-change", true);
        });

        mainWindow.on("restore", () => {
            mainWindow.webContents.send("window:minimize-change", false);
        });

        // Handle window state changes
        mainWindow.on("show", () => {
            mainWindow.webContents.send("window:visibility-change", true);
        });

        mainWindow.on("hide", () => {
            mainWindow.webContents.send("window:visibility-change", false);
        });

        // Handle window focus/blur
        mainWindow.on("focus", () => {
            mainWindow.webContents.send("window:focus-change", true);
        });

        mainWindow.on("blur", () => {
            mainWindow.webContents.send("window:focus-change", false);
        });
    }

    // Set window title
    ipcMain.handle("window:setTitle", (event, title) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitle(title || "TerminalQueue");
            return { success: true, title: mainWindow.getTitle() };
        }
        return { success: false, error: "Window not available" };
    });

    // Get window bounds
    ipcMain.handle("window:getBounds", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.getBounds();
        }
        return null;
    });

    // Set window bounds
    ipcMain.handle("window:setBounds", (event, bounds) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setBounds(bounds);
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Set window size
    ipcMain.handle("window:setSize", (event, width, height) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSize(width, height);
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Center window
    ipcMain.handle("window:center", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.center();
            return { success: true };
        }
        return { success: false, error: "Window not available" };
    });

    // Set window always on top
    ipcMain.handle("window:setAlwaysOnTop", (event, isAlwaysOnTop) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(isAlwaysOnTop);
            return { success: true, isAlwaysOnTop };
        }
        return { success: false, error: "Window not available" };
    });

    // Check if window is always on top
    ipcMain.handle("window:isAlwaysOnTop", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.isAlwaysOnTop();
        }
        return false;
    });

    // Set window opacity
    ipcMain.handle("window:setOpacity", (event, opacity) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const clampedOpacity = Math.min(1, Math.max(0, opacity));
            mainWindow.setOpacity(clampedOpacity);
            return { success: true, opacity: clampedOpacity };
        }
        return { success: false, error: "Window not available" };
    });

    // Get window opacity
    ipcMain.handle("window:getOpacity", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.getOpacity();
        }
        return 1;
    });
}

module.exports = { registerWindowHandlers };
