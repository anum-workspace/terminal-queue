const { ipcMain } = require("electron");
const os = require("os");
const path = require("path");
const pty = require("node-pty");
const treeKill = require("tree-kill");

const terminals = new Map(); // tabId -> { pty, process }

function registerTerminalHandlers(mainWindow) {
    ipcMain.handle("terminal:create", (event, { tabId, rows, cols, cwd }) => {
        return new Promise((resolve, reject) => {
            try {
                // Determine the shell based on platform
                const shell =
                    os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

                // Use provided cwd, or fall back to OS home directory
                const homeDir = os.homedir();
                const workingDir =
                    cwd && cwd !== "~"
                        ? cwd.replace(/^~/, homeDir) // Replace ~ with actual home path
                        : homeDir;

                // Ensure the directory exists, fallback to home if not
                const fs = require("fs");
                let finalCwd = workingDir;
                try {
                    if (!fs.existsSync(finalCwd)) {
                        console.warn(
                            `Directory ${finalCwd} does not exist, falling back to ${homeDir}`,
                        );
                        finalCwd = homeDir;
                    }
                } catch (err) {
                    console.warn(
                        `Error checking directory ${finalCwd}, falling back to ${homeDir}`,
                    );
                    finalCwd = homeDir;
                }

                console.log(`Creating terminal in: ${finalCwd}`);

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

                const terminalId = tabId;
                terminals.set(terminalId, {
                    pty: ptyProcess,
                    process: ptyProcess.pid,
                    cwd: finalCwd,
                });

                // Send data to renderer
                ptyProcess.onData((data) => {
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`terminal:data-${terminalId}`, data);
                        }
                    } catch (err) {
                        console.error("Error sending terminal data:", err);
                    }
                });

                // Handle process exit
                ptyProcess.onExit(({ exitCode }) => {
                    console.log(`Command ${id} exited with code ${exitCode}`);

                    // Determine status
                    let status = "completed";
                    if (exitCode !== 0) {
                        status = "failed";
                    }

                    // Save to history IMMEDIATELY
                    const homeDir = os.homedir();
                    const finalDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

                    const { getDb } = require("../database");
                    getDb().run(
                        `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            finalDir,
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
                                console.log(
                                    `Saved command execution to history with ID: ${this.lastID}`,
                                );

                                // Send history update event to renderer
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.webContents.send("history:updated");
                                }
                            }
                        },
                    );

                    // Notify renderer of completion
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`command:complete-${id}`, {
                                exitCode,
                                status,
                                output: output.substring(0, 5000),
                            });
                        }
                    } catch (err) {
                        console.error("Error sending completion event:", err);
                    }

                    // Clean up
                    setTimeout(() => {
                        terminals.delete(execTermId);
                    }, 5000);

                    resolve({
                        id,
                        exitCode,
                        status,
                        output: output.substring(0, 5000),
                    });
                });

                resolve({
                    pid: ptyProcess.pid,
                    cwd: finalCwd,
                    shell: shell,
                });
            } catch (error) {
                console.error("Error creating terminal:", error);
                reject(error);
            }
        });
    });

    ipcMain.handle("terminal:write", (event, { tabId, data }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            try {
                term.pty.write(data);
                return { success: true };
            } catch (error) {
                console.error("Error writing to terminal:", error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: "Terminal not found" };
    });

    ipcMain.handle("terminal:resize", (event, { tabId, rows, cols }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            try {
                term.pty.resize(cols, rows);
                return { success: true };
            } catch (error) {
                console.error("Error resizing terminal:", error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: "Terminal not found" };
    });

    ipcMain.handle("terminal:kill", (event, { tabId }) => {
        const term = terminals.get(tabId);
        if (term) {
            try {
                treeKill(term.process, "SIGTERM", (err) => {
                    if (err) {
                        console.error("Error killing terminal process:", err);
                    }
                });
                terminals.delete(tabId);
                return { success: true };
            } catch (error) {
                console.error("Error killing terminal:", error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: "Terminal not found" };
    });

    // Get terminal CWD
    ipcMain.handle("terminal:getCwd", (event, { tabId }) => {
        const term = terminals.get(tabId);
        if (term) {
            return term.cwd;
        }
        return os.homedir();
    });

    // Change terminal directory (if needed)
    ipcMain.handle("terminal:changeDir", (event, { tabId, newDir }) => {
        const term = terminals.get(tabId);
        if (term && term.pty) {
            const homeDir = os.homedir();
            const resolvedDir = newDir && newDir !== "~" ? newDir.replace(/^~/, homeDir) : homeDir;

            term.cwd = resolvedDir;
            // Send cd command to terminal
            term.pty.write(`cd "${resolvedDir}"\n`);
            return { success: true, cwd: resolvedDir };
        }
        return { success: false, error: "Terminal not found" };
    });

    // Execute a single command in terminal
    ipcMain.handle("terminal:executeCommand", (event, queueItem) => {
        return new Promise((resolve, reject) => {
            try {
                const { id, dir, header, command, footer } = queueItem;

                // Get or create a terminal for execution
                const homeDir = os.homedir();
                const workingDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

                // Ensure directory exists
                const fs = require("fs");
                let finalCwd = workingDir;
                try {
                    if (!fs.existsSync(finalCwd)) {
                        console.warn(
                            `Directory ${finalCwd} does not exist, falling back to ${homeDir}`,
                        );
                        finalCwd = homeDir;
                    }
                } catch (err) {
                    finalCwd = homeDir;
                }

                // Create a dedicated terminal for command execution
                const shell =
                    os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

                const execTermId = `exec-${id || Date.now()}`;

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
                let hasError = false;

                // Collect output
                ptyProcess.onData((data) => {
                    output += data;

                    // Send output to all terminal tabs for display
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            // Send to all active terminal tabs
                            terminals.forEach((term, tabId) => {
                                if (term && term.pty) {
                                    mainWindow.webContents.send(
                                        `terminal:data-${tabId}`,
                                        `\r\n\x1b[36m[Queue #${id}]\x1b[0m ${command}\r\n${data}`,
                                    );
                                }
                            });

                            // Also send execution-specific events
                            mainWindow.webContents.send(`command:output-${id}`, data);
                        }
                    } catch (err) {
                        console.error("Error sending command output:", err);
                    }
                });

                // Handle process exit
                ptyProcess.onExit(({ exitCode }) => {
                    console.log(`Command ${id} exited with code ${exitCode}`);

                    // Determine status
                    let status = "completed";
                    if (exitCode !== 0) {
                        status = "failed";
                        hasError = true;
                    }

                    // Save to history
                    const { getDb } = require("../database");
                    getDb().run(
                        `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            finalCwd,
                            header || "",
                            command,
                            footer || "",
                            status,
                            output.substring(0, 10000),
                        ],
                        function (err) {
                            if (err) {
                                console.error("Error saving to history:", err);
                            }
                        },
                    );

                    // Notify renderer
                    try {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(`command:complete-${id}`, {
                                exitCode,
                                status,
                                output: output.substring(0, 5000),
                            });
                        }
                    } catch (err) {
                        console.error("Error sending completion event:", err);
                    }

                    // Clean up after delay
                    setTimeout(() => {
                        terminals.delete(execTermId);
                    }, 5000);

                    resolve({
                        id,
                        exitCode,
                        status,
                        output: output.substring(0, 5000),
                    });
                });

                // Store the execution terminal
                terminals.set(execTermId, {
                    pty: ptyProcess,
                    process: ptyProcess.pid,
                    cwd: finalCwd,
                    isExecution: true,
                });

                // Build the full command with header and footer
                let fullCommand = "";

                // Set directory
                fullCommand += `cd "${finalCwd}"\n`;

                // Add header if exists
                if (header && header.trim()) {
                    fullCommand += `echo "\x1b[33m[Header]\x1b[0m ${header.replace(/"/g, '\\"')}"\n`;
                    fullCommand += `${header}\n`;
                }

                // Echo the command
                fullCommand += `echo "\x1b[36m[Queue #${id}]\x1b[0m ${command.replace(/"/g, '\\"')}"\n`;

                // Add main command
                fullCommand += `${command}\n`;
                const commandExitCode = "$?";

                // Add footer if exists
                if (footer && footer.trim()) {
                    fullCommand += `echo "\x1b[33m[Footer]\x1b[0m ${footer.replace(/"/g, '\\"')}"\n`;
                    fullCommand += `${footer}\n`;
                }

                // Echo completion
                fullCommand += `echo "\x1b[32m✓ Command completed with exit code: ${commandExitCode}\x1b[0m"\n`;

                // Write the command
                ptyProcess.write(fullCommand);
            } catch (error) {
                console.error("Error executing command:", error);
                reject(error);
            }
        });
    });

    // Stop a running command
    ipcMain.handle("terminal:stopCommand", (event, queueId) => {
        return new Promise((resolve, reject) => {
            try {
                const execTermId = `exec-${queueId}`;
                const term = terminals.get(execTermId);

                if (term && term.pty) {
                    // Send Ctrl+C to stop the command
                    term.pty.write("\x03");

                    // Also try killing the process after a delay
                    setTimeout(() => {
                        if (terminals.has(execTermId)) {
                            treeKill(term.process, "SIGTERM", (err) => {
                                if (err) {
                                    console.error("Error killing process:", err);
                                }
                            });
                            terminals.delete(execTermId);
                        }
                    }, 2000);

                    resolve({ success: true, message: "Stop signal sent" });
                } else {
                    // Check if there's any terminal with this queue ID
                    let found = false;
                    terminals.forEach((t, key) => {
                        if (key.includes(`exec-${queueId}`)) {
                            treeKill(t.process, "SIGTERM");
                            terminals.delete(key);
                            found = true;
                        }
                    });

                    if (found) {
                        resolve({ success: true, message: "Process terminated" });
                    } else {
                        resolve({ success: false, message: "No running process found" });
                    }
                }
            } catch (error) {
                console.error("Error stopping command:", error);
                reject(error);
            }
        });
    });

    // Execute all queue items sequentially
    ipcMain.handle("terminal:executeQueue", async (event) => {
        return new Promise(async (resolve, reject) => {
            try {
                const { getDb } = require("../database");

                // Get all pending queue items
                const queueItems = await new Promise((res, rej) => {
                    getDb().all(
                        "SELECT * FROM queue WHERE status = 'pending' ORDER BY order_position ASC",
                        (err, rows) => {
                            if (err) rej(err);
                            else res(rows);
                        },
                    );
                });

                if (queueItems.length === 0) {
                    resolve({ success: true, message: "No pending commands", executed: 0 });
                    return;
                }

                // Notify renderer that queue execution started
                mainWindow.webContents.send("queue:execution-started", {
                    total: queueItems.length,
                    items: queueItems,
                });

                let executed = 0;
                let failed = 0;

                // Execute commands sequentially
                for (const item of queueItems) {
                    try {
                        // Update status to running
                        getDb().run("UPDATE queue SET status = 'running' WHERE id = ?", [item.id]);

                        mainWindow.webContents.send("queue:item-running", item);

                        // Execute the command
                        const result = await ipcMain.emit("terminal:executeCommand", event, item);

                        // Update status based on result
                        const status = result.exitCode === 0 ? "completed" : "failed";
                        getDb().run("UPDATE queue SET status = ? WHERE id = ?", [status, item.id]);

                        if (status === "completed") {
                            executed++;
                            mainWindow.webContents.send("queue:item-completed", {
                                ...item,
                                status,
                            });
                        } else {
                            failed++;
                            mainWindow.webContents.send("queue:item-failed", { ...item, status });
                        }
                    } catch (error) {
                        failed++;
                        getDb().run("UPDATE queue SET status = 'failed' WHERE id = ?", [item.id]);
                        mainWindow.webContents.send("queue:item-failed", {
                            ...item,
                            status: "failed",
                            error: error.message,
                        });
                    }
                }

                // Notify completion
                mainWindow.webContents.send("queue:execution-completed", {
                    total: queueItems.length,
                    executed,
                    failed,
                });

                resolve({
                    success: true,
                    total: queueItems.length,
                    executed,
                    failed,
                });
            } catch (error) {
                console.error("Error executing queue:", error);
                reject(error);
            }
        });
    });

    // Get command execution status
    ipcMain.handle("terminal:getCommandStatus", (event, queueId) => {
        const execTermId = `exec-${queueId}`;
        const term = terminals.get(execTermId);

        if (term) {
            return {
                running: true,
                pid: term.process,
                cwd: term.cwd,
            };
        }

        return {
            running: false,
        };
    });
}

// Clean up all terminals
function cleanupTerminals() {
    terminals.forEach((term, tabId) => {
        try {
            if (term.process) {
                treeKill(term.process, "SIGTERM");
            }
        } catch (error) {
            console.error(`Error cleaning up terminal ${tabId}:`, error);
        }
    });
    terminals.clear();
}

module.exports = { registerTerminalHandlers, cleanupTerminals };
