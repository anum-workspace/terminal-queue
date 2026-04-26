const { ipcMain } = require("electron");
const { getDb } = require("../database");

function registerStartupHandlers() {
    // Get all startup commands
    ipcMain.handle("startup:getAll", () => {
        return new Promise((resolve, reject) => {
            getDb().all("SELECT * FROM startup ORDER BY order_position ASC", (err, rows) => {
                if (err) {
                    console.error("Error fetching startup commands:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });

    // Get single startup command
    ipcMain.handle("startup:getById", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM startup WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching startup command:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("Startup command not found"));
                } else {
                    resolve(row);
                }
            });
        });
    });

    // Add startup command
    ipcMain.handle("startup:add", (event, startupItem) => {
        return new Promise((resolve, reject) => {
            const { dir, header, command, footer, delay } = startupItem;

            // Get current max order_position
            getDb().get("SELECT MAX(order_position) as maxOrder FROM startup", (err, row) => {
                if (err) {
                    console.error("Error getting max order:", err);
                    reject(err);
                    return;
                }

                const nextOrder = (row.maxOrder || -1) + 1;

                getDb().run(
                    `INSERT INTO startup (dir, header, command, footer, delay, order_position) VALUES (?, ?, ?, ?, ?, ?)`,
                    [dir || "~", header || "", command, footer || "", delay || 0, nextOrder],
                    function (err) {
                        if (err) {
                            console.error("Error adding startup command:", err);
                            reject(err);
                        } else {
                            resolve({
                                id: this.lastID,
                                ...startupItem,
                                order_position: nextOrder,
                            });
                        }
                    },
                );
            });
        });
    });

    // Update startup command
    ipcMain.handle("startup:update", (event, id, startupItem) => {
        return new Promise((resolve, reject) => {
            const { dir, header, command, footer, delay } = startupItem;

            getDb().run(
                `UPDATE startup SET dir = ?, header = ?, command = ?, footer = ?, delay = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
                [dir || "~", header || "", command, footer || "", delay || 0, id],
                function (err) {
                    if (err) {
                        console.error("Error updating startup command:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("Startup command not found"));
                    } else {
                        resolve({ success: true, id, ...startupItem });
                    }
                },
            );
        });
    });

    // Delete startup command
    ipcMain.handle("startup:delete", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM startup WHERE id = ?", [id], function (err) {
                if (err) {
                    console.error("Error deleting startup command:", err);
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error("Startup command not found"));
                } else {
                    // Reorder remaining items
                    getDb().all(
                        "SELECT id FROM startup ORDER BY order_position ASC",
                        (err, rows) => {
                            if (!err) {
                                const updateStmt = getDb().prepare(
                                    "UPDATE startup SET order_position = ? WHERE id = ?",
                                );
                                rows.forEach((row, index) => {
                                    updateStmt.run(index, row.id);
                                });
                                updateStmt.finalize();
                            }
                        },
                    );

                    resolve({ success: true, id });
                }
            });
        });
    });

    // Clear all startup commands
    ipcMain.handle("startup:clear", () => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM startup", function (err) {
                if (err) {
                    console.error("Error clearing startup commands:", err);
                    reject(err);
                } else {
                    resolve({ success: true, deletedCount: this.changes });
                }
            });
        });
    });

    // Reorder startup commands
    ipcMain.handle("startup:reorder", (event, orderedIds) => {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
                reject(new Error("No IDs provided for reordering"));
                return;
            }

            const updateStmt = getDb().prepare(
                "UPDATE startup SET order_position = ? WHERE id = ?",
            );

            let completed = 0;
            let hasError = false;

            orderedIds.forEach((id, index) => {
                updateStmt.run(index, id, (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        console.error("Error reordering startup commands:", err);
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

    // Execute all startup commands (called on app startup)
    ipcMain.handle("startup:executeAll", () => {
        return new Promise(async (resolve, reject) => {
            try {
                const startupCommands = await new Promise((res, rej) => {
                    getDb().all(
                        "SELECT * FROM startup ORDER BY order_position ASC",
                        (err, rows) => {
                            if (err) rej(err);
                            else res(rows);
                        },
                    );
                });

                // Return the commands to be executed by the main process
                resolve(startupCommands);
            } catch (error) {
                console.error("Error fetching startup commands for execution:", error);
                reject(error);
            }
        });
    });

    // Duplicate startup command
    ipcMain.handle("startup:duplicate", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM startup WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching startup command for duplication:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("Startup command not found"));
                } else {
                    // Get next order position
                    getDb().get(
                        "SELECT MAX(order_position) as maxOrder FROM startup",
                        (err, orderRow) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const nextOrder = (orderRow.maxOrder || -1) + 1;

                            getDb().run(
                                `INSERT INTO startup (dir, header, command, footer, delay, order_position) VALUES (?, ?, ?, ?, ?, ?)`,
                                [
                                    row.dir,
                                    row.header,
                                    row.command,
                                    row.footer,
                                    row.delay,
                                    nextOrder,
                                ],
                                function (err) {
                                    if (err) {
                                        console.error("Error duplicating startup command:", err);
                                        reject(err);
                                    } else {
                                        resolve({
                                            id: this.lastID,
                                            dir: row.dir,
                                            header: row.header,
                                            command: row.command,
                                            footer: row.footer,
                                            delay: row.delay,
                                            order_position: nextOrder,
                                        });
                                    }
                                },
                            );
                        },
                    );
                }
            });
        });
    });

    // Validate startup command (check if command is executable, etc.)
    ipcMain.handle("startup:validate", (event, startupItem) => {
        return new Promise((resolve) => {
            const errors = [];

            if (!startupItem.command || startupItem.command.trim() === "") {
                errors.push("Command is required");
            }

            if (startupItem.delay && (isNaN(startupItem.delay) || startupItem.delay < 0)) {
                errors.push("Delay must be a non-negative number");
            }

            if (startupItem.dir && startupItem.dir.trim() === "") {
                errors.push("Directory cannot be empty");
            }

            resolve({
                valid: errors.length === 0,
                errors,
            });
        });
    });

    // Get startup statistics
    ipcMain.handle("startup:getStats", () => {
        return new Promise((resolve, reject) => {
            getDb().get(
                `SELECT 
          COUNT(*) as total,
          SUM(delay) as totalDelay,
          AVG(delay) as avgDelay,
          MIN(delay) as minDelay,
          MAX(delay) as maxDelay
        FROM startup`,
                (err, stats) => {
                    if (err) {
                        console.error("Error getting startup stats:", err);
                        reject(err);
                    } else {
                        resolve(stats);
                    }
                },
            );
        });
    });
}

module.exports = { registerStartupHandlers };
