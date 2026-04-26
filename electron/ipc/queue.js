const { ipcMain } = require("electron");
const { getDb } = require("../database");
const os = require("os");
const path = require("path");
const fs = require("fs");

// Terminals reference (will be set by main.js)
let terminals = new Map();

// Store the stop state at module level so it persists across IPC calls
let stopRequested = false;
let currentExecutionMainWindow = null;

function setTerminals(termMap) {
    terminals = termMap;
}

// Execute a single command silently
function executeSingleCommand(queueItem, mainWindow, stopCheck) {
    return new Promise((resolve, reject) => {
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

        const ptyProcess = require("node-pty").spawn(shell, [], {
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

        // Store the PTY process reference for stopping
        const execTermId = `exec-${id}`;
        if (typeof terminals !== "undefined" && terminals) {
            terminals.set(execTermId, {
                pty: ptyProcess,
                process: ptyProcess.pid,
                cwd: finalCwd,
                isExecution: true,
            });
        }

        // Set timeout (10 minutes)
        timeout = setTimeout(() => {
            if (!isCompleted) {
                isCompleted = true;
                try {
                    require("tree-kill")(ptyProcess.pid, "SIGTERM");
                } catch (err) {
                    console.error("Error killing process:", err);
                }
                resolve({
                    exitCode: -1,
                    output: output + "\n[Command timed out after 10 minutes]",
                    error: "Command timed out",
                });
            }
        }, 600000);

        // Check for stop signal periodically
        const stopInterval = setInterval(() => {
            if (stopCheck && stopCheck()) {
                console.log(`Stop requested for command ${id}, killing process`);
                clearInterval(stopInterval);
                if (!isCompleted) {
                    isCompleted = true;
                    clearTimeout(timeout);
                    try {
                        require("tree-kill")(ptyProcess.pid, "SIGTERM");
                    } catch (err) {
                        console.error("Error killing stopped process:", err);
                    }
                    resolve({
                        exitCode: -1,
                        output: output + "\n[Stopped by user]",
                        error: "Stopped by user",
                    });
                }
            }
        }, 500); // Check every 500ms

        ptyProcess.onData((data) => {
            output += data;

            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Send to user terminal tabs
                    if (terminals && terminals.size > 0) {
                        terminals.forEach((term, tabId) => {
                            if (term && term.pty && !term.isExecution) {
                                mainWindow.webContents.send(`terminal:data-${tabId}`, data);
                            }
                        });
                    }

                    // Send to command output channel
                    mainWindow.webContents.send(`command:output-${id}`, data);
                }
            } catch (err) {
                console.error("Error sending output:", err);
            }
        });

        ptyProcess.onExit(({ exitCode }) => {
            if (!isCompleted) {
                isCompleted = true;
                clearTimeout(timeout);
                clearInterval(stopInterval);

                // Clean up terminals map
                if (typeof terminals !== "undefined" && terminals) {
                    terminals.delete(execTermId);
                }

                resolve({
                    exitCode: exitCode || 0,
                    output: output,
                    error: exitCode !== 0 ? `Exit code: ${exitCode}` : null,
                });
            }
        });

        // Build command silently
        let fullCommand = "";
        fullCommand += `cd "${finalCwd}" 2>/dev/null\n`;

        if (header && header.trim()) {
            fullCommand += `${header}\n`;
        }

        fullCommand += `${command}\n`;
        const cmdExit = "$?";

        if (footer && footer.trim()) {
            fullCommand += `${footer}\n`;
        }

        fullCommand += `exit ${cmdExit}\n`;

        ptyProcess.write(fullCommand);
    });
}

// Save execution to history
function saveToHistory(queueItem, result, status) {
    return new Promise((resolve, reject) => {
        const { dir, header, command, footer } = queueItem;
        const homeDir = os.homedir();
        const finalDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

        getDb().run(
            `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                finalDir,
                header || "",
                command,
                footer || "",
                status,
                result.output ? result.output.substring(0, 50000) : "",
            ],
            function (err) {
                if (err) {
                    console.error("Error saving to history:", err);
                    reject(err);
                } else {
                    console.log(`Saved to history with ID: ${this.lastID}`);
                    resolve({ id: this.lastID });
                }
            },
        );
    });
}

function registerQueueHandlers(mainWindow) {
    // ==================== BASIC CRUD OPERATIONS ====================

    // Get all queue items
    ipcMain.handle("queue:getAll", () => {
        return new Promise((resolve, reject) => {
            getDb().all("SELECT * FROM queue ORDER BY order_position ASC", (err, rows) => {
                if (err) {
                    console.error("Error fetching queue:", err);
                    reject(err);
                } else {
                    const homeDir = os.homedir();
                    const resolved = rows.map((row) => ({
                        ...row,
                        dir: row.dir === "~" ? homeDir : row.dir,
                    }));
                    resolve(resolved);
                }
            });
        });
    });

    // Get single queue item by ID
    ipcMain.handle("queue:getById", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM queue WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching queue item:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("Queue item not found"));
                } else {
                    resolve(row);
                }
            });
        });
    });

    // Add new queue item
    ipcMain.handle("queue:add", (event, item) => {
        return new Promise((resolve, reject) => {
            const { dir, header, command, footer } = item;

            if (!command || command.trim() === "") {
                reject(new Error("Command is required"));
                return;
            }

            getDb().get("SELECT MAX(order_position) as maxOrder FROM queue", (err, row) => {
                if (err) {
                    console.error("Error getting max order:", err);
                    reject(err);
                    return;
                }

                const nextOrder = (row.maxOrder || -1) + 1;
                const homeDir = os.homedir();
                let normalizedDir = dir || "~";
                if (normalizedDir === "~") {
                    normalizedDir = homeDir;
                } else {
                    normalizedDir = normalizedDir.replace(/^~/, homeDir);
                }

                getDb().run(
                    `INSERT INTO queue (dir, header, command, footer, status, order_position) 
             VALUES (?, ?, ?, ?, 'pending', ?)`,
                    [normalizedDir, header || "", command.trim(), footer || "", nextOrder],
                    function (err) {
                        if (err) {
                            console.error("Error adding queue item:", err);
                            reject(err);
                        } else {
                            resolve({
                                id: this.lastID,
                                dir: normalizedDir,
                                header: header || "",
                                command: command.trim(),
                                footer: footer || "",
                                status: "pending",
                                order_position: nextOrder,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    },
                );
            });
        });
    });

    // Update queue item
    ipcMain.handle("queue:update", (event, id, updates) => {
        return new Promise((resolve, reject) => {
            const allowedFields = [
                "dir",
                "header",
                "command",
                "footer",
                "status",
                "order_position",
            ];
            const setClauses = [];
            const params = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClauses.push(`${key} = ?`);
                    if (key === "dir" && value) {
                        const homeDir = os.homedir();
                        params.push(value.replace(/^~/, homeDir));
                    } else {
                        params.push(value);
                    }
                }
            }

            if (setClauses.length === 0) {
                reject(new Error("No valid fields to update"));
                return;
            }

            setClauses.push("timestamp = CURRENT_TIMESTAMP");
            params.push(id);

            getDb().run(
                `UPDATE queue SET ${setClauses.join(", ")} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error("Error updating queue item:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("Queue item not found"));
                    } else {
                        resolve({ success: true, id, ...updates });
                    }
                },
            );
        });
    });

    // Delete queue item
    ipcMain.handle("queue:delete", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM queue WHERE id = ?", [id], function (err) {
                if (err) {
                    console.error("Error deleting queue item:", err);
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error("Queue item not found"));
                } else {
                    // Reorder remaining items
                    getDb().all("SELECT id FROM queue ORDER BY order_position ASC", (err, rows) => {
                        if (!err) {
                            const updateStmt = getDb().prepare(
                                "UPDATE queue SET order_position = ? WHERE id = ?",
                            );
                            rows.forEach((row, index) => {
                                updateStmt.run(index, row.id);
                            });
                            updateStmt.finalize();
                        }
                    });
                    resolve({ success: true, id });
                }
            });
        });
    });

    // Clear all queue items
    ipcMain.handle("queue:clear", () => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM queue", function (err) {
                if (err) {
                    console.error("Error clearing queue:", err);
                    reject(err);
                } else {
                    resolve({ success: true, deletedCount: this.changes });
                }
            });
        });
    });

    // Reorder queue items
    ipcMain.handle("queue:reorder", (event, orderedIds) => {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
                reject(new Error("No IDs provided for reordering"));
                return;
            }

            const updateStmt = getDb().prepare("UPDATE queue SET order_position = ? WHERE id = ?");

            let completed = 0;
            let hasError = false;

            orderedIds.forEach((id, index) => {
                updateStmt.run(index, id, (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        console.error("Error reordering queue:", err);
                        updateStmt.finalize();
                        reject(err);
                        return;
                    }

                    completed++;
                    if (completed === orderedIds.length) {
                        updateStmt.finalize();
                        resolve({ success: true, reorderedCount: completed });
                    }
                });
            });
        });
    });

    // Move item up/down
    ipcMain.handle("queue:moveItem", (event, id, direction) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM queue WHERE id = ?", [id], (err, currentItem) => {
                if (err || !currentItem) {
                    reject(new Error("Queue item not found"));
                    return;
                }

                const currentOrder = currentItem.order_position;
                const targetOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;

                getDb().get(
                    "SELECT * FROM queue WHERE order_position = ?",
                    [targetOrder],
                    (err, swapItem) => {
                        if (err || !swapItem) {
                            reject(new Error("Cannot move further"));
                            return;
                        }

                        getDb().run(
                            "UPDATE queue SET order_position = ? WHERE id = ?",
                            [targetOrder, currentItem.id],
                            (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                getDb().run(
                                    "UPDATE queue SET order_position = ? WHERE id = ?",
                                    [currentOrder, swapItem.id],
                                    (err) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }
                                        resolve({ success: true });
                                    },
                                );
                            },
                        );
                    },
                );
            });
        });
    });

    // Update status
    ipcMain.handle("queue:updateStatus", (event, id, status) => {
        return new Promise((resolve, reject) => {
            const validStatuses = [
                "pending",
                "running",
                "completed",
                "failed",
                "stopped",
                "queued",
            ];

            if (!validStatuses.includes(status)) {
                reject(new Error(`Invalid status: ${status}`));
                return;
            }

            getDb().run(
                "UPDATE queue SET status = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?",
                [status, id],
                function (err) {
                    if (err) {
                        console.error("Error updating queue status:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("Queue item not found"));
                    } else {
                        resolve({ success: true, id, status });
                    }
                },
            );
        });
    });

    // Get queue stats
    ipcMain.handle("queue:getStats", () => {
        return new Promise((resolve, reject) => {
            getDb().get(
                `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped
        FROM queue`,
                (err, stats) => {
                    if (err) {
                        console.error("Error getting queue stats:", err);
                        reject(err);
                    } else {
                        resolve(
                            stats || {
                                total: 0,
                                pending: 0,
                                running: 0,
                                completed: 0,
                                failed: 0,
                                stopped: 0,
                            },
                        );
                    }
                },
            );
        });
    });

    // Duplicate queue item
    ipcMain.handle("queue:duplicate", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM queue WHERE id = ?", [id], (err, row) => {
                if (err || !row) {
                    reject(new Error("Queue item not found"));
                    return;
                }

                getDb().get(
                    "SELECT MAX(order_position) as maxOrder FROM queue",
                    (err, orderRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const nextOrder = (orderRow.maxOrder || -1) + 1;

                        getDb().run(
                            `INSERT INTO queue (dir, header, command, footer, status, order_position) 
                 VALUES (?, ?, ?, ?, 'pending', ?)`,
                            [row.dir, row.header, row.command, row.footer, nextOrder],
                            function (err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({
                                        id: this.lastID,
                                        ...row,
                                        status: "pending",
                                        order_position: nextOrder,
                                    });
                                }
                            },
                        );
                    },
                );
            });
        });
    });

    // ==================== EXECUTION OPERATIONS ====================

    // Run all queue items
    ipcMain.handle("queue:runAll", async (event) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Reset stop flag at start
                stopRequested = false;
                currentExecutionMainWindow = mainWindow;

                // Get all pending queue items
                const queueItems = await new Promise((res, rej) => {
                    getDb().all(
                        "SELECT * FROM queue WHERE status IN ('pending', 'queued') ORDER BY order_position ASC",
                        (err, rows) => {
                            if (err) rej(err);
                            else res(rows || []);
                        },
                    );
                });

                if (queueItems.length === 0) {
                    resolve({
                        success: true,
                        message: "No pending commands in queue",
                        executed: 0,
                    });
                    return;
                }

                console.log(`Starting queue execution: ${queueItems.length} items`);

                // Notify renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("queue:execution-started", {
                        total: queueItems.length,
                        items: queueItems,
                    });
                }

                let executed = 0;
                let failed = 0;
                let stoppedCount = 0;

                // Execute commands sequentially
                for (let i = 0; i < queueItems.length; i++) {
                    // CHECK STOP FLAG BEFORE EACH COMMAND
                    if (stopRequested) {
                        console.log(
                            `Queue execution stopped by user at item ${i + 1}/${queueItems.length}`,
                        );

                        // Mark remaining items as stopped
                        for (let j = i; j < queueItems.length; j++) {
                            try {
                                await new Promise((res, rej) => {
                                    getDb().run(
                                        "UPDATE queue SET status = 'stopped' WHERE id = ?",
                                        [queueItems[j].id],
                                        (err) => (err ? rej(err) : res()),
                                    );
                                });
                                stoppedCount++;
                            } catch (err) {
                                console.error("Error updating stopped status:", err);
                            }
                        }
                        break;
                    }

                    const item = queueItems[i];

                    try {
                        console.log(
                            `Executing command ${i + 1}/${queueItems.length}: ${item.command.substring(0, 50)}...`,
                        );

                        // Update to running
                        await new Promise((res, rej) => {
                            getDb().run(
                                "UPDATE queue SET status = 'running' WHERE id = ?",
                                [item.id],
                                (err) => (err ? rej(err) : res()),
                            );
                        });

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send("queue:item-running", {
                                ...item,
                                status: "running",
                                index: i,
                            });
                        }

                        // Execute command - this will throw if stopped during execution
                        const result = await executeSingleCommand(
                            item,
                            mainWindow,
                            () => stopRequested,
                        );

                        // Check if stopped during execution
                        if (stopRequested) {
                            const status = "stopped";
                            await new Promise((res, rej) => {
                                getDb().run(
                                    "UPDATE queue SET status = ? WHERE id = ?",
                                    [status, item.id],
                                    (err) => (err ? rej(err) : res()),
                                );
                            });

                            // Save partial output to history
                            try {
                                await saveToHistory(
                                    item,
                                    { exitCode: -1, output: result.output || "Stopped by user" },
                                    status,
                                );
                            } catch (e) {
                                console.error("Error saving stopped to history:", e);
                            }

                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send("queue:item-stopped", {
                                    ...item,
                                    status,
                                });
                            }

                            stoppedCount++;

                            // Mark remaining as stopped
                            for (let j = i + 1; j < queueItems.length; j++) {
                                try {
                                    await new Promise((res, rej) => {
                                        getDb().run(
                                            "UPDATE queue SET status = 'stopped' WHERE id = ?",
                                            [queueItems[j].id],
                                            (err) => (err ? rej(err) : res()),
                                        );
                                    });
                                    stoppedCount++;
                                } catch (err) {
                                    console.error("Error updating stopped status:", err);
                                }
                            }
                            break;
                        }

                        const status = result.exitCode === 0 ? "completed" : "failed";

                        // Update queue status
                        await new Promise((res, rej) => {
                            getDb().run(
                                "UPDATE queue SET status = ? WHERE id = ?",
                                [status, item.id],
                                (err) => (err ? rej(err) : res()),
                            );
                        });

                        // Save to history
                        await saveToHistory(item, result, status);

                        if (status === "completed") {
                            executed++;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send("queue:item-completed", {
                                    ...item,
                                    status,
                                    exitCode: result.exitCode,
                                    index: i,
                                });
                            }
                        } else {
                            failed++;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send("queue:item-failed", {
                                    ...item,
                                    status,
                                    exitCode: result.exitCode,
                                    error: result.error,
                                    index: i,
                                });
                            }
                        }

                        // Small delay between commands (but check stop flag)
                        if (!stopRequested) {
                            await new Promise((resolve) => setTimeout(resolve, 500));
                        }
                    } catch (error) {
                        console.error(`Error executing queue item ${item.id}:`, error);
                        failed++;

                        await new Promise((res, rej) => {
                            getDb().run(
                                "UPDATE queue SET status = 'failed' WHERE id = ?",
                                [item.id],
                                (err) => (err ? rej(err) : res()),
                            );
                        });

                        try {
                            await saveToHistory(
                                item,
                                { exitCode: -1, output: error.message },
                                "failed",
                            );
                        } catch (e) {
                            console.error("Error saving failed to history:", e);
                        }

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send("queue:item-failed", {
                                ...item,
                                status: "failed",
                                error: error.message,
                                index: i,
                            });
                        }
                    }
                }

                // Reset stop flag
                stopRequested = false;
                currentExecutionMainWindow = null;

                const result = {
                    success: true,
                    total: queueItems.length,
                    executed,
                    failed,
                    stopped: stoppedCount,
                    wasStopped: executed + failed < queueItems.length,
                };

                console.log("Queue execution completed:", result);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("queue:execution-completed", result);
                    mainWindow.webContents.send("history:updated");
                }

                resolve(result);
            } catch (error) {
                console.error("Error executing queue:", error);
                stopRequested = false;
                currentExecutionMainWindow = null;
                reject(error);
            }
        });
    });

    // Execute single command (for Execute Now)
    ipcMain.handle("queue:executeSingle", async (event, queueItem) => {
        try {
            getDb().run("UPDATE queue SET status = 'running' WHERE id = ?", [queueItem.id]);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("queue:item-running", {
                    ...queueItem,
                    status: "running",
                });
            }

            const result = await executeSingleCommand(queueItem, mainWindow);
            const status = result.exitCode === 0 ? "completed" : "failed";

            getDb().run("UPDATE queue SET status = ? WHERE id = ?", [status, queueItem.id]);
            await saveToHistory(queueItem, result, status);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(`command:complete-${queueItem.id}`, {
                    exitCode: result.exitCode,
                    status,
                    output: result.output?.substring(0, 5000),
                });
                mainWindow.webContents.send("history:updated");
            }

            return { success: true, exitCode: result.exitCode, status };
        } catch (error) {
            console.error("Error executing single command:", error);
            throw error;
        }
    });

    // Stop queue execution
    ipcMain.handle("queue:stopExecution", (event) => {
        stopRequested = true;
        console.log("Stop signal received for queue execution");

        // Also emit to any running commands to stop
        if (currentExecutionMainWindow && !currentExecutionMainWindow.isDestroyed()) {
            currentExecutionMainWindow.webContents.send("queue:stopping");
        }

        return { success: true, message: "Stop signal sent" };
    });

    // Check if stop was requested
    ipcMain.handle("queue:isStopping", () => {
        return { stopping: stopRequested };
    });

    console.log("Queue IPC handlers registered successfully");
}

module.exports = { registerQueueHandlers, setTerminals };
