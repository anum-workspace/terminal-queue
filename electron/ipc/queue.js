const { ipcMain } = require("electron");
const { getDb } = require("../database");
const os = require("os");
const path = require("path");

// Helper function to execute a single command
function executeSingleCommand(queueItem, mainWindow) {
    return new Promise((resolve, reject) => {
        const { id, dir, header, command, footer } = queueItem;
        const homeDir = os.homedir();
        const workingDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

        const fs = require("fs");
        let finalCwd = workingDir;
        try {
            if (!fs.existsSync(finalCwd)) {
                console.warn(`Directory ${finalCwd} does not exist, using ${homeDir}`);
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

        // Set a reasonable timeout (5 minutes)
        timeout = setTimeout(() => {
            if (!isCompleted) {
                isCompleted = true;
                console.log(`Command ${id} timed out, killing process`);
                try {
                    require("tree-kill")(ptyProcess.pid, "SIGTERM");
                } catch (err) {
                    console.error("Error killing timed out process:", err);
                }
                resolve({
                    exitCode: -1,
                    output: output + "\n\x1b[31m[Command timed out after 5 minutes]\x1b[0m",
                    error: "Command timed out",
                });
            }
        }, 300000); // 5 minutes

        ptyProcess.onData((data) => {
            output += data;

            // Send output to renderer
            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(`command:output-${id}`, data);
                }
            } catch (err) {
                console.error("Error sending command output:", err);
            }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
            if (!isCompleted) {
                isCompleted = true;
                clearTimeout(timeout);

                console.log(
                    `Command ${id} completed with exit code: ${exitCode}, signal: ${signal}`,
                );

                resolve({
                    exitCode: exitCode || 0,
                    output: output,
                    error: exitCode !== 0 ? `Exit code: ${exitCode}` : null,
                });
            }
        });

        // Build the command with proper exit detection
        let fullCommand = "";

        // Change to working directory
        if (shell.includes("bash") || shell.includes("zsh") || shell.includes("sh")) {
            fullCommand += `cd "${finalCwd}" 2>/dev/null || true\n`;
        } else {
            fullCommand += `cd "${finalCwd}"\n`;
        }

        // Echo start marker
        fullCommand += `echo "\\x1b[36m═══ Command Started ═══\\x1b[0m"\n`;

        // Execute header if exists
        if (header && header.trim()) {
            fullCommand += `echo "\\x1b[33m[Header] ${header.replace(/"/g, '\\"')}\\x1b[0m"\n`;
            fullCommand += `${header}\n`;
            fullCommand += `echo "\\x1b[32m✓ Header completed with code: $?\\x1b[0m"\n`;
        }

        // Execute main command
        fullCommand += `echo "\\x1b[36m[Command] ${command.replace(/"/g, '\\"')}\\x1b[0m"\n`;
        fullCommand += `${command}\n`;
        fullCommand += `COMMAND_EXIT=$?\n`;

        // Execute footer if exists
        if (footer && footer.trim()) {
            fullCommand += `echo "\\x1b[33m[Footer] ${footer.replace(/"/g, '\\"')}\\x1b[0m"\n`;
            fullCommand += `${footer}\n`;
            fullCommand += `FOOTER_EXIT=$?\n`;
        }

        // Echo completion with exit code
        fullCommand += `echo ""\n`;
        fullCommand += `echo "\\x1b[32m═══ Command Completed (Exit: $COMMAND_EXIT) ═══\\x1b[0m"\n`;

        // Exit the shell to signal completion
        fullCommand += `exit $COMMAND_EXIT\n`;

        // Write the command
        ptyProcess.write(fullCommand);
    });
}

// Helper function to save execution to history
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
                    resolve({ id: this.lastID });
                }
            },
        );
    });
}

function registerQueueHandlers(mainWindow) {
    // Get all queue items
    ipcMain.handle("queue:getAll", () => {
        return new Promise((resolve, reject) => {
            getDb().all("SELECT * FROM queue ORDER BY order_position ASC", (err, rows) => {
                if (err) {
                    console.error("Error fetching queue:", err);
                    reject(err);
                } else {
                    // Resolve ~ to actual home directory for display
                    const resolved = rows.map((row) => ({
                        ...row,
                        dir: row.dir === "~" ? os.homedir() : row.dir.replace(/^~/, os.homedir()),
                    }));
                    resolve(resolved);
                }
            });
        });
    });

    // Get single queue item
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

            // Validate command
            if (!command || command.trim() === "") {
                reject(new Error("Command is required"));
                return;
            }

            // Get current max order_position
            getDb().get("SELECT MAX(order_position) as maxOrder FROM queue", (err, row) => {
                if (err) {
                    console.error("Error getting max order:", err);
                    reject(err);
                    return;
                }

                const nextOrder = (row.maxOrder || -1) + 1;

                // Normalize directory
                let normalizedDir = dir || "~";
                if (normalizedDir === "~") {
                    normalizedDir = os.homedir();
                } else {
                    normalizedDir = normalizedDir.replace(/^~/, os.homedir());
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
                    // Normalize directory if it's being updated
                    if (key === "dir" && value) {
                        params.push(value.replace(/^~/, os.homedir()));
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

    // Move queue item up or down
    ipcMain.handle("queue:moveItem", (event, id, direction) => {
        return new Promise((resolve, reject) => {
            // Get current item
            getDb().get("SELECT * FROM queue WHERE id = ?", [id], (err, currentItem) => {
                if (err || !currentItem) {
                    reject(new Error("Queue item not found"));
                    return;
                }

                const currentOrder = currentItem.order_position;
                const targetOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;

                // Get item to swap with
                getDb().get(
                    "SELECT * FROM queue WHERE order_position = ?",
                    [targetOrder],
                    (err, swapItem) => {
                        if (err || !swapItem) {
                            reject(new Error("Cannot move further"));
                            return;
                        }

                        // Swap order positions
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

    // Update queue item status
    ipcMain.handle("queue:updateStatus", (event, id, status) => {
        return new Promise((resolve, reject) => {
            const validStatuses = ["pending", "running", "completed", "failed", "stopped"];

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

    // Get queue statistics
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
                        resolve(stats);
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

    // Run entire queue (called from Navbar)
    ipcMain.handle("queue:runAll", async (event) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get all pending queue items
                const queueItems = await new Promise((res, rej) => {
                    getDb().all(
                        "SELECT * FROM queue WHERE status IN ('pending', 'queued') ORDER BY order_position ASC",
                        (err, rows) => {
                            if (err) rej(err);
                            else res(rows);
                        },
                    );
                });

                console.log(`Found ${queueItems.length} items to execute`);

                if (queueItems.length === 0) {
                    resolve({
                        success: true,
                        message: "No pending commands in queue",
                        executed: 0,
                    });
                    return;
                }

                // Notify renderer that execution started
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("queue:execution-started", {
                        total: queueItems.length,
                        items: queueItems,
                    });
                }

                let executed = 0;
                let failed = 0;
                let stopped = false;

                // Listen for stop signal
                const stopHandler = () => {
                    stopped = true;
                };

                if (mainWindow) {
                    ipcMain.once("queue:stop-execution", stopHandler);
                }

                // Execute commands sequentially
                for (let i = 0; i < queueItems.length; i++) {
                    if (stopped) {
                        console.log("Queue execution stopped by user");
                        // Update remaining items
                        for (let j = i; j < queueItems.length; j++) {
                            getDb().run("UPDATE queue SET status = 'stopped' WHERE id = ?", [
                                queueItems[j].id,
                            ]);
                        }
                        break;
                    }

                    const item = queueItems[i];

                    try {
                        console.log(`Executing queue item ${item.id}: ${item.command}`);

                        // Update status to running
                        getDb().run("UPDATE queue SET status = 'running' WHERE id = ?", [item.id]);

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send("queue:item-running", {
                                ...item,
                                status: "running",
                            });
                        }

                        // Execute command and wait for completion
                        const result = await executeSingleCommand(item, mainWindow);

                        console.log(
                            `Queue item ${item.id} completed with exit code: ${result.exitCode}`,
                        );

                        // Determine status based on exit code
                        const status = result.exitCode === 0 ? "completed" : "failed";

                        // Update queue status
                        getDb().run("UPDATE queue SET status = ? WHERE id = ?", [status, item.id]);

                        // Save to history
                        try {
                            await saveToHistory(item, result, status);
                            console.log(`Saved to history: ${item.id}`);
                        } catch (historyErr) {
                            console.error("Error saving to history:", historyErr);
                        }

                        if (status === "completed") {
                            executed++;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send("queue:item-completed", {
                                    ...item,
                                    status,
                                    exitCode: result.exitCode,
                                    output: result.output?.substring(0, 1000),
                                });
                            }
                        } else {
                            failed++;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send("queue:item-failed", {
                                    ...item,
                                    status,
                                    exitCode: result.exitCode,
                                    error: result.error || `Exit code: ${result.exitCode}`,
                                });
                            }
                        }

                        // Small delay between commands
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error(`Error executing queue item ${item.id}:`, error);
                        failed++;

                        // Update status to failed
                        getDb().run("UPDATE queue SET status = 'failed' WHERE id = ?", [item.id]);

                        // Save failed attempt to history
                        try {
                            await saveToHistory(
                                item,
                                { exitCode: -1, output: error.message },
                                "failed",
                            );
                        } catch (historyErr) {
                            console.error("Error saving failed to history:", historyErr);
                        }

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send("queue:item-failed", {
                                ...item,
                                status: "failed",
                                error: error.message,
                            });
                        }
                    }
                }

                // Clean up stop listener
                if (mainWindow) {
                    ipcMain.removeListener("queue:stop-execution", stopHandler);
                }

                // Notify completion
                const result = {
                    success: true,
                    total: queueItems.length,
                    executed,
                    failed,
                    stopped,
                };

                console.log("Queue execution completed:", result);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("queue:execution-completed", result);
                    // Also trigger history refresh
                    mainWindow.webContents.send("history:updated");
                }

                resolve(result);
            } catch (error) {
                console.error("Error executing queue:", error);
                reject(error);
            }
        });
    });

    // Stop queue execution
    ipcMain.handle("queue:stopExecution", () => {
        // This will be caught by the runAll handler
        return { success: true, message: "Stop signal sent" };
    });
}

module.exports = { registerQueueHandlers };
