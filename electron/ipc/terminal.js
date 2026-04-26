const { ipcMain } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const pty = require("node-pty");
const treeKill = require("tree-kill");

const terminals = new Map(); // Export this for queue to use

function registerTerminalHandlers(mainWindow) {
    // Create terminal for user interaction
    ipcMain.handle("terminal:create", (event, { tabId, rows, cols, cwd }) => {
        return new Promise((resolve, reject) => {
            try {
                const shell =
                    os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

                const homeDir = os.homedir();
                const workingDir = cwd && cwd !== "~" ? cwd.replace(/^~/, homeDir) : homeDir;

                let finalCwd = workingDir;
                try {
                    if (!fs.existsSync(finalCwd)) {
                        finalCwd = homeDir;
                    }
                } catch (err) {
                    finalCwd = homeDir;
                }

                // Kill existing terminal for this tab if any
                const existing = terminals.get(tabId);
                if (existing) {
                    try {
                        treeKill(existing.process, "SIGTERM");
                    } catch (err) {
                        // Ignore
                    }
                    terminals.delete(tabId);
                }

                const ptyProcess = pty.spawn(shell, [], {
                    name: "xterm-color",
                    cols: cols || 80,
                    rows: rows || 24,
                    cwd: finalCwd,
                    env: {
                        ...process.env,
                        HOME: homeDir,
                        TERM: "xterm-256color",
                        COLORTERM: "truecolor",
                    },
                });

                terminals.set(tabId, {
                    pty: ptyProcess,
                    process: ptyProcess.pid,
                    cwd: finalCwd,
                    isExecution: false,
                });

                ptyProcess.onData((data) => {
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`terminal:data-${tabId}`, data);
                        }
                    } catch (err) {
                        console.error("Error sending terminal data:", err);
                    }
                });

                ptyProcess.onExit(({ exitCode, signal }) => {
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`terminal:exit-${tabId}`, exitCode);
                        }
                    } catch (err) {
                        console.error("Error sending exit event:", err);
                    }
                    terminals.delete(tabId);
                });

                resolve({ pid: ptyProcess.pid, cwd: finalCwd, shell });
            } catch (error) {
                console.error("Error creating terminal:", error);
                reject(error);
            }
        });
    });

    // Write to terminal
    ipcMain.handle("terminal:write", (event, { tabId, data }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            term.pty.write(data);
            return { success: true };
        }
        return { success: false, error: "Terminal not found" };
    });

    // Resize terminal
    ipcMain.handle("terminal:resize", (event, { tabId, rows, cols }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            term.pty.resize(cols, rows);
            return { success: true };
        }
        return { success: false, error: "Terminal not found" };
    });

    // Kill terminal
    ipcMain.handle("terminal:kill", (event, { tabId }) => {
        const term = terminals.get(tabId);
        if (term) {
            try {
                treeKill(term.process, "SIGTERM");
            } catch (err) {
                console.error("Error killing terminal:", err);
            }
            terminals.delete(tabId);
            return { success: true };
        }
        return { success: false, error: "Terminal not found" };
    });

    // Change directory
    ipcMain.handle("terminal:changeDir", (event, { tabId, newDir }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            const homeDir = os.homedir();
            const resolvedDir = newDir && newDir !== "~" ? newDir.replace(/^~/, homeDir) : homeDir;

            term.cwd = resolvedDir;
            term.pty.write(`cd "${resolvedDir}"\n`);
            return { success: true, cwd: resolvedDir };
        }
        return { success: false, error: "Terminal not found" };
    });

    // Execute single command (for "Execute Now")
    ipcMain.handle("terminal:executeCommand", async (event, queueItem) => {
        return new Promise((resolve, reject) => {
            try {
                const { id, dir, header, command, footer } = queueItem;
                const homeDir = os.homedir();
                const workingDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

                let finalCwd = workingDir;
                try {
                    if (!fs.existsSync(finalCwd)) {
                        finalCwd = homeDir;
                    }
                } catch (err) {
                    finalCwd = homeDir;
                }

                const shell =
                    os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

                const execTermId = `exec-${id}`;

                // Kill existing execution terminal if any
                const existing = terminals.get(execTermId);
                if (existing) {
                    try {
                        treeKill(existing.process, "SIGTERM");
                    } catch (err) {}
                    terminals.delete(execTermId);
                }

                const ptyProcess = pty.spawn(shell, [], {
                    name: "xterm-color",
                    cols: 120,
                    rows: 30,
                    cwd: finalCwd,
                    env: {
                        ...process.env,
                        HOME: homeDir,
                        TERM: "xterm-256color",
                    },
                });

                let output = "";
                let isCompleted = false;
                let timeout;

                // Set timeout
                timeout = setTimeout(() => {
                    if (!isCompleted) {
                        isCompleted = true;
                        try {
                            treeKill(ptyProcess.pid, "SIGTERM");
                        } catch (err) {
                            console.error("Error killing timed out process:", err);
                        }

                        // Resolve with timeout error
                        const timeoutOutput = output + "\n[Command timed out after 10 minutes]";

                        // Save to history
                        try {
                            const { getDb } = require("../database");
                            getDb().run(
                                `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
                                [
                                    finalCwd,
                                    header || "",
                                    command,
                                    footer || "",
                                    "failed",
                                    timeoutOutput.substring(0, 50000),
                                ],
                            );
                        } catch (err) {
                            console.error("Error saving timeout to history:", err);
                        }

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`command:complete-${id}`, {
                                exitCode: -1,
                                status: "failed",
                                output: timeoutOutput.substring(0, 5000),
                                error: "Command timed out",
                            });
                            mainWindow.webContents.send("history:updated");
                        }

                        setTimeout(() => terminals.delete(execTermId), 5000);

                        resolve({
                            id,
                            exitCode: -1,
                            status: "failed",
                            output: timeoutOutput.substring(0, 5000),
                            error: "Command timed out",
                        });
                    }
                }, 600000); // 10 minutes

                ptyProcess.onData((data) => {
                    output += data;

                    // Send to user terminal tabs
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            terminals.forEach((term, tabId) => {
                                if (term && term.pty && !term.isExecution && tabId !== execTermId) {
                                    mainWindow.webContents.send(`terminal:data-${tabId}`, data);
                                }
                            });

                            mainWindow.webContents.send(`command:output-${id}`, data);
                        }
                    } catch (err) {
                        console.error("Error sending output:", err);
                    }
                });

                ptyProcess.onExit(({ exitCode, signal }) => {
                    // Use the captured resolve from the outer Promise
                    if (!isCompleted) {
                        isCompleted = true;
                        clearTimeout(timeout);

                        console.log(
                            `Command ${id} exited with code: ${exitCode}, signal: ${signal}`,
                        );

                        // Save to history
                        const status = exitCode === 0 || exitCode === null ? "completed" : "failed";

                        try {
                            const { getDb } = require("../database");
                            getDb().run(
                                `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
                                [
                                    finalCwd,
                                    header || "",
                                    command,
                                    footer || "",
                                    status,
                                    output.substring(0, 50000),
                                ],
                                function (err) {
                                    if (err) {
                                        console.error("Error saving to history:", err);
                                    } else {
                                        console.log(`Saved to history: ${this.lastID}`);
                                    }
                                },
                            );
                        } catch (err) {
                            console.error("Error saving to history:", err);
                        }

                        // Send completion event
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`command:complete-${id}`, {
                                exitCode: exitCode || 0,
                                status,
                                output: output.substring(0, 5000),
                            });
                            mainWindow.webContents.send("history:updated");
                        }

                        // Clean up after delay
                        setTimeout(() => {
                            terminals.delete(execTermId);
                        }, 5000);

                        // RESOLVE THE PROMISE HERE
                        resolve({
                            id,
                            exitCode: exitCode || 0,
                            status,
                            output: output.substring(0, 5000),
                        });
                    }
                });

                // Store the terminal reference
                terminals.set(execTermId, {
                    pty: ptyProcess,
                    process: ptyProcess.pid,
                    cwd: finalCwd,
                    isExecution: true,
                });

                // Build command silently
                let fullCommand = "";
                fullCommand += `cd "${finalCwd}" 2>/dev/null || true\n`;

                if (header && header.trim()) {
                    fullCommand += `${header}\n`;
                }

                fullCommand += `${command}\n`;

                if (footer && footer.trim()) {
                    fullCommand += `${footer}\n`;
                }

                fullCommand += `exit\n`;

                // Write the command
                ptyProcess.write(fullCommand);
            } catch (error) {
                console.error("Error in executeCommand:", error);
                reject(error);
            }
        });
    });

    // Stop command
    ipcMain.handle("terminal:stopCommand", (event, queueId) => {
        const execTermId = `exec-${queueId}`;
        const term = terminals.get(execTermId);

        if (term) {
            term.pty.write("\x03"); // Ctrl+C
            setTimeout(() => {
                if (terminals.has(execTermId)) {
                    treeKill(term.process, "SIGTERM");
                    terminals.delete(execTermId);
                }
            }, 2000);
            return { success: true };
        }
        return { success: false, message: "No running process found" };
    });
}

function cleanupTerminals() {
    terminals.forEach((term, tabId) => {
        try {
            if (term.process) treeKill(term.process, "SIGTERM");
        } catch (error) {
            console.error(`Error cleaning up terminal ${tabId}:`, error);
        }
    });
    terminals.clear();
}

// Export terminals so queue.js can access it
function getTerminals() {
    return terminals;
}

module.exports = { registerTerminalHandlers, cleanupTerminals, getTerminals };
