const { ipcMain } = require("electron");
const { getDb } = require("../database");

function registerCommandsHandlers() {
    // Get all commands, optionally filtered by group
    ipcMain.handle("commands:getAll", (event, group) => {
        return new Promise((resolve, reject) => {
            let query = "SELECT * FROM commands";
            let params = [];

            if (group && group !== "All Commands") {
                query += " WHERE group_name = ?";
                params.push(group);
            }

            query += " ORDER BY timestamp DESC";

            getDb().all(query, params, (err, rows) => {
                if (err) {
                    console.error("Error fetching commands:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });

    // Get all unique command groups
    ipcMain.handle("commands:getGroups", () => {
        return new Promise((resolve, reject) => {
            getDb().all(
                'SELECT DISTINCT group_name FROM commands WHERE group_name != "All Commands" ORDER BY group_name',
                (err, rows) => {
                    if (err) {
                        console.error("Error fetching groups:", err);
                        reject(err);
                    } else {
                        resolve(rows.map((row) => row.group_name));
                    }
                },
            );
        });
    });

    // Save new command
    ipcMain.handle("commands:save", (event, commandData) => {
        return new Promise((resolve, reject) => {
            const { group_name, header, command, footer } = commandData;

            getDb().run(
                `INSERT INTO commands (group_name, header, command, footer) VALUES (?, ?, ?, ?)`,
                [group_name || "All Commands", header || "", command, footer || ""],
                function (err) {
                    if (err) {
                        console.error("Error saving command:", err);
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, ...commandData });
                    }
                },
            );
        });
    });

    // Update existing command
    ipcMain.handle("commands:update", (event, id, commandData) => {
        return new Promise((resolve, reject) => {
            const { group_name, header, command, footer } = commandData;

            getDb().run(
                `UPDATE commands SET group_name = ?, header = ?, command = ?, footer = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
                [group_name || "All Commands", header || "", command, footer || "", id],
                function (err) {
                    if (err) {
                        console.error("Error updating command:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("Command not found"));
                    } else {
                        resolve({ id, ...commandData });
                    }
                },
            );
        });
    });

    // Delete command
    ipcMain.handle("commands:delete", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().run("DELETE FROM commands WHERE id = ?", [id], function (err) {
                if (err) {
                    console.error("Error deleting command:", err);
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error("Command not found"));
                } else {
                    resolve({ success: true, id });
                }
            });
        });
    });

    // Add new group (creates a placeholder or just validates)
    ipcMain.handle("commands:addGroup", (event, groupName) => {
        return new Promise((resolve, reject) => {
            // Check if group already exists
            getDb().get(
                "SELECT COUNT(*) as count FROM commands WHERE group_name = ?",
                [groupName],
                (err, row) => {
                    if (err) {
                        console.error("Error checking group:", err);
                        reject(err);
                    } else if (row.count > 0) {
                        reject(new Error("Group already exists"));
                    } else {
                        // Create a placeholder entry to establish the group
                        getDb().run(
                            `INSERT INTO commands (group_name, header, command, footer) VALUES (?, '', 'echo "Group created"', '')`,
                            [groupName],
                            function (err) {
                                if (err) {
                                    console.error("Error creating group:", err);
                                    reject(err);
                                } else {
                                    resolve({ success: true, groupName });
                                }
                            },
                        );
                    }
                },
            );
        });
    });

    // Delete entire group
    ipcMain.handle("commands:deleteGroup", (event, groupName) => {
        return new Promise((resolve, reject) => {
            if (
                groupName === "All Commands" ||
                groupName === "Gromacs" ||
                groupName === "Favourite"
            ) {
                reject(new Error("Cannot delete default groups"));
                return;
            }

            getDb().run("DELETE FROM commands WHERE group_name = ?", [groupName], function (err) {
                if (err) {
                    console.error("Error deleting group:", err);
                    reject(err);
                } else {
                    resolve({ success: true, groupName, deletedCount: this.changes });
                }
            });
        });
    });

    // Get command by ID
    ipcMain.handle("commands:getById", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM commands WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching command:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("Command not found"));
                } else {
                    resolve(row);
                }
            });
        });
    });

    // Search commands
    ipcMain.handle("commands:search", (event, searchTerm) => {
        return new Promise((resolve, reject) => {
            const query = `%${searchTerm}%`;
            getDb().all(
                `SELECT * FROM commands WHERE command LIKE ? OR header LIKE ? OR footer LIKE ? OR group_name LIKE ? ORDER BY timestamp DESC`,
                [query, query, query, query],
                (err, rows) => {
                    if (err) {
                        console.error("Error searching commands:", err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                },
            );
        });
    });

    // Duplicate command
    ipcMain.handle("commands:duplicate", (event, id) => {
        return new Promise((resolve, reject) => {
            getDb().get("SELECT * FROM commands WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error("Error fetching command for duplication:", err);
                    reject(err);
                } else if (!row) {
                    reject(new Error("Command not found"));
                } else {
                    getDb().run(
                        `INSERT INTO commands (group_name, header, command, footer) VALUES (?, ?, ?, ?)`,
                        [row.group_name, row.header, row.command, row.footer],
                        function (err) {
                            if (err) {
                                console.error("Error duplicating command:", err);
                                reject(err);
                            } else {
                                resolve({ id: this.lastID, ...row });
                            }
                        },
                    );
                }
            });
        });
    });
}

module.exports = { registerCommandsHandlers };
