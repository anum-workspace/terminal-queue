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

            query += " ORDER BY group_name ASC, title ASC, timestamp DESC";

            getDb().all(query, params, (err, rows) => {
                if (err) {
                    console.error("Error fetching commands:", err);
                    reject(err);
                } else {
                    // Ensure all rows have a title (fallback to command preview)
                    const processed = rows.map((row) => ({
                        ...row,
                        title: row.title || generateTitleFromCommand(row.command),
                    }));
                    resolve(processed);
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
            const { title, group_name, header, command, footer } = commandData;

            if (!command || command.trim() === "") {
                reject(new Error("Command is required"));
                return;
            }

            const finalTitle = title || generateTitleFromCommand(command);

            getDb().run(
                `INSERT INTO commands (title, group_name, header, command, footer) VALUES (?, ?, ?, ?, ?)`,
                [
                    finalTitle,
                    group_name || "All Commands",
                    header || "",
                    command.trim(),
                    footer || "",
                ],
                function (err) {
                    if (err) {
                        console.error("Error saving command:", err);
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            title: finalTitle,
                            group_name: group_name || "All Commands",
                            header: header || "",
                            command: command.trim(),
                            footer: footer || "",
                            timestamp: new Date().toISOString(),
                        });
                    }
                },
            );
        });
    });

    // Update existing command
    ipcMain.handle("commands:update", (event, id, commandData) => {
        return new Promise((resolve, reject) => {
            const { title, group_name, header, command, footer } = commandData;

            if (!command || command.trim() === "") {
                reject(new Error("Command is required"));
                return;
            }

            const finalTitle = title || generateTitleFromCommand(command);

            getDb().run(
                `UPDATE commands SET title = ?, group_name = ?, header = ?, command = ?, footer = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
                [
                    finalTitle,
                    group_name || "All Commands",
                    header || "",
                    command.trim(),
                    footer || "",
                    id,
                ],
                function (err) {
                    if (err) {
                        console.error("Error updating command:", err);
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error("Command not found"));
                    } else {
                        resolve({ success: true, id, title: finalTitle, ...commandData });
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
                `SELECT * FROM commands 
         WHERE command LIKE ? 
            OR title LIKE ? 
            OR header LIKE ? 
            OR footer LIKE ? 
            OR group_name LIKE ? 
         ORDER BY group_name ASC, title ASC, timestamp DESC`,
                [query, query, query, query, query],
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

    // Add new group
    ipcMain.handle("commands:addGroup", (event, groupName) => {
        return new Promise((resolve, reject) => {
            if (!groupName || groupName.trim() === "") {
                reject(new Error("Group name is required"));
                return;
            }

            // Check if group already exists
            getDb().get(
                "SELECT COUNT(*) as count FROM commands WHERE group_name = ?",
                [groupName.trim()],
                (err, row) => {
                    if (err) {
                        console.error("Error checking group:", err);
                        reject(err);
                    } else if (row.count > 0) {
                        reject(new Error("Group already exists"));
                    } else {
                        // Create a placeholder entry to establish the group
                        getDb().run(
                            `INSERT INTO commands (title, group_name, header, command, footer) VALUES (?, ?, '', ?, '')`,
                            [
                                "New Command",
                                groupName.trim(),
                                'echo "Group: ' + groupName.trim() + '"',
                            ],
                            function (err) {
                                if (err) {
                                    console.error("Error creating group:", err);
                                    reject(err);
                                } else {
                                    resolve({ success: true, groupName: groupName.trim() });
                                }
                            },
                        );
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
                        `INSERT INTO commands (title, group_name, header, command, footer) VALUES (?, ?, ?, ?, ?)`,
                        [
                            `${row.title || "Command"} (Copy)`,
                            row.group_name,
                            row.header,
                            row.command,
                            row.footer,
                        ],
                        function (err) {
                            if (err) {
                                console.error("Error duplicating command:", err);
                                reject(err);
                            } else {
                                resolve({ id: this.lastID, ...row, title: `${row.title} (Copy)` });
                            }
                        },
                    );
                }
            });
        });
    });
}

// Helper function to generate title from command
function generateTitleFromCommand(command) {
    if (!command) return "Untitled Command";

    // Truncate and clean up command for title
    let title = command.trim();

    // Take first line only if multiline
    if (title.includes("\n")) {
        title = title.split("\n")[0];
    }

    // Remove common prefixes
    title = title.replace(/^(sudo|echo|printf)\s+/i, "");

    // Truncate if too long
    if (title.length > 50) {
        title = title.substring(0, 47) + "...";
    }

    return title;
}

module.exports = { registerCommandsHandlers };
