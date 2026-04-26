const { ipcMain } = require("electron");
const { getDb } = require("../database");

function registerHistoryHandlers() {
    // Get all history items
    ipcMain.handle("history:getAll", (event, filter = {}) => {
        return new Promise((resolve, reject) => {
            let query = "SELECT * FROM history";
            let params = [];
            let conditions = [];

            if (filter.status && filter.status !== "all") {
                conditions.push("status = ?");
                params.push(filter.status);
            }

            if (filter.searchTerm) {
                conditions.push("(command LIKE ? OR header LIKE ? OR footer LIKE ? OR dir LIKE ?)");
                const searchQuery = `%${filter.searchTerm}%`;
                params.push(searchQuery, searchQuery, searchQuery, searchQuery);
            }

            if (conditions.length > 0) {
                query += " WHERE " + conditions.join(" AND ");
            }

            query += " ORDER BY timestamp DESC";

            // Limit results for performance
            if (filter.limit) {
                query += " LIMIT ?";
                params.push(filter.limit);
            } else {
                query += " LIMIT 1000"; // Default limit
            }

            getDb().all(query, params, (err, rows) => {
                if (err) {
                    console.error("Error fetching history:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });

    // Get single history item
    ipcMain.handle("history:getById", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM history WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching history item:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("History item not found"));
                } else {
                    resolve(row);
                }
            });
        });
    });

    // Add history item
    ipcMain.handle("history:add", (event, historyItem) => {
        return new Promise((resolve, reject) => {
            const { dir, header, command, footer, status, log } = historyItem;

            // Validate required fields
            if (!command || command.trim() === "") {
                reject(new Error("Command is required for history"));
                return;
            }

            const homeDir = require("os").homedir();
            const finalDir = dir && dir !== "~" ? dir.replace(/^~/, homeDir) : homeDir;

            getDb().run(
                `INSERT INTO history (dir, header, command, footer, status, log) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    finalDir,
                    header || "",
                    command.trim(),
                    footer || "",
                    status || "unknown",
                    log || "",
                ],
                function (err) {
                    if (err) {
                        console.error("Error adding to history:", err);
                        reject(err);
                    } else {
                        console.log(`Added history item ${this.lastID}`);
                        resolve({
                            id: this.lastID,
                            dir: finalDir,
                            header: header || "",
                            command: command.trim(),
                            footer: footer || "",
                            status: status || "unknown",
                            log: log || "",
                            timestamp: new Date().toISOString(),
                        });
                    }
                },
            );
        });
    });

    // Update history item (e.g., after execution completes)
    ipcMain.handle("history:update", (event, id, updates) => {
        return new Promise((resolve, reject) => {
            const allowedFields = ["status", "log", "dir", "header", "command", "footer"];
            const setClauses = [];
            const params = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClauses.push(`${key} = ?`);
                    params.push(value);
                }
            }

            if (setClauses.length === 0) {
                reject(new Error("No valid fields to update"));
                return;
            }

            setClauses.push("timestamp = CURRENT_TIMESTAMP");
            params.push(id);

            getDb().run(
                `UPDATE history SET ${setClauses.join(", ")} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error("Error updating history:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("History item not found"));
                    } else {
                        resolve({ success: true, id, ...updates });
                    }
                },
            );
        });
    });

    // Delete multiple history items
    ipcMain.handle("history:delete", (event, ids) => {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(ids) || ids.length === 0) {
                reject(new Error("No IDs provided"));
                return;
            }

            const placeholders = ids.map(() => "?").join(",");

            getDb().run(`DELETE FROM history WHERE id IN (${placeholders})`, ids, function (err) {
                if (err) {
                    console.error("Error deleting history:", err);
                    reject(err);
                } else {
                    resolve({ success: true, deletedCount: this.changes });
                }
            });
        });
    });

    // Delete all history
    ipcMain.handle("history:clearAll", () => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM history", function (err) {
                if (err) {
                    console.error("Error clearing history:", err);
                    reject(err);
                } else {
                    resolve({ success: true, deletedCount: this.changes });
                }
            });
        });
    });

    // Add history item to command group
    ipcMain.handle("history:addToGroup", (event, historyId, groupName) => {
        return new Promise((resolve, reject) => {
            // First get the history item
            getDb().get("SELECT * FROM history WHERE id = ?", [historyId], (err, historyItem) => {
                if (err) {
                    console.error("Error fetching history item:", err);
                    reject(err);
                } else if (!historyItem) {
                    reject(new Error("History item not found"));
                } else {
                    // Save as managed command
                    getDb().run(
                        `INSERT INTO commands (group_name, header, command, footer) VALUES (?, ?, ?, ?)`,
                        [
                            groupName,
                            historyItem.header || "",
                            historyItem.command,
                            historyItem.footer || "",
                        ],
                        function (err) {
                            if (err) {
                                console.error("Error adding to group:", err);
                                reject(err);
                            } else {
                                resolve({
                                    success: true,
                                    commandId: this.lastID,
                                    historyId,
                                    groupName,
                                });
                            }
                        },
                    );
                }
            });
        });
    });

    // Retry command (add back to queue)
    ipcMain.handle("history:retry", (event, historyItem) => {
        return new Promise((resolve, reject) => {
            const { dir, header, command, footer } = historyItem;

            // Get current max order_position
            getDb().get("SELECT MAX(order_position) as maxOrder FROM queue", (err, row) => {
                if (err) {
                    console.error("Error getting max order:", err);
                    reject(err);
                    return;
                }

                const nextOrder = (row.maxOrder || 0) + 1;

                getDb().run(
                    `INSERT INTO queue (dir, header, command, footer, status, order_position) VALUES (?, ?, ?, ?, 'pending', ?)`,
                    [dir || "~", header || "", command, footer || "", nextOrder],
                    function (err) {
                        if (err) {
                            console.error("Error retrying command:", err);
                            reject(err);
                        } else {
                            resolve({
                                success: true,
                                queueId: this.lastID,
                                historyId: historyItem.id,
                            });
                        }
                    },
                );
            });
        });
    });

    // Get history statistics
    ipcMain.handle("history:getStats", () => {
        return new Promise((resolve, reject) => {
            getDb().all(
                `SELECT 
          status, 
          COUNT(*) as count,
          MIN(timestamp) as firstExecution,
          MAX(timestamp) as lastExecution
        FROM history 
        GROUP BY status`,
                (err, rows) => {
                    if (err) {
                        console.error("Error getting history stats:", err);
                        reject(err);
                    } else {
                        const stats = {
                            total: 0,
                            successful: 0,
                            failed: 0,
                            terminated: 0,
                            error: 0,
                        };

                        rows.forEach((row) => {
                            stats.total += row.count;
                            stats[row.status] = row.count;
                        });

                        resolve(stats);
                    }
                },
            );
        });
    });

    // Search history with full-text search (simplified)
    ipcMain.handle("history:search", (event, searchTerm) => {
        return new Promise((resolve, reject) => {
            const query = `%${searchTerm}%`;
            getDb().all(
                `SELECT * FROM history 
         WHERE command LIKE ? 
            OR header LIKE ? 
            OR footer LIKE ? 
            OR dir LIKE ? 
            OR log LIKE ?
         ORDER BY timestamp DESC 
         LIMIT 500`,
                [query, query, query, query, query],
                (err, rows) => {
                    if (err) {
                        console.error("Error searching history:", err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                },
            );
        });
    });
}

module.exports = { registerHistoryHandlers };
