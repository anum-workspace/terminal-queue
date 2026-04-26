const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

let db;

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                id: this.lastID,
                changes: this.changes,
            });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row ?? null);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows ?? []);
        });
    });
}

function normalizeText(value, fallback = "") {
    if (value == null) {
        return fallback;
    }

    return String(value).trim();
}

function normalizeDir(value) {
    return normalizeText(value, process.env.HOME || "~");
}

function normalizeJob(payload = {}) {
    return {
        dir: normalizeDir(payload.dir),
        header: normalizeText(payload.header),
        command: normalizeText(payload.command),
        footer: normalizeText(payload.footer),
    };
}

async function initDB() {
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "db");

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, "database.db");
    db = new sqlite3.Database(dbPath);

    await run(`
        CREATE TABLE IF NOT EXISTS queue (
            id INTEGER PRIMARY KEY,
            dir TEXT NOT NULL,
            header TEXT DEFAULT '',
            command TEXT NOT NULL,
            footer TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            order_index INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY,
            dir TEXT NOT NULL,
            header TEXT DEFAULT '',
            command TEXT NOT NULL,
            footer TEXT DEFAULT '',
            status TEXT DEFAULT 'success',
            log TEXT DEFAULT '',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS commands (
            id INTEGER PRIMARY KEY,
            group_name TEXT DEFAULT 'All Commands',
            title TEXT DEFAULT '',
            header TEXT DEFAULT '',
            command TEXT NOT NULL,
            footer TEXT DEFAULT '',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS startup (
            id INTEGER PRIMARY KEY,
            dir TEXT NOT NULL,
            header TEXT DEFAULT '',
            command TEXT NOT NULL,
            footer TEXT DEFAULT '',
            delay INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            order_index INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getNextOrderIndex(tableName) {
    const row = await get(`SELECT COALESCE(MAX(order_index), -1) AS max_order FROM ${tableName}`);
    return (row?.max_order ?? -1) + 1;
}

async function listItems(tableName) {
    return all(
        `SELECT * FROM ${tableName} ORDER BY order_index ASC, timestamp ASC, id ASC`,
    );
}

async function createQueuedItem(tableName, payload = {}) {
    const job = normalizeJob(payload);

    if (!job.command) {
        throw new Error("Command is required.");
    }

    const orderIndex = await getNextOrderIndex(tableName);
    const delay = tableName === "startup" ? Number(payload.delay || 0) : undefined;

    const insert = tableName === "startup"
        ? await run(
            `INSERT INTO startup (dir, header, command, footer, delay, status, order_index)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [job.dir, job.header, job.command, job.footer, delay, orderIndex],
        )
        : await run(
            `INSERT INTO queue (dir, header, command, footer, status, order_index)
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [job.dir, job.header, job.command, job.footer, orderIndex],
        );

    return get(`SELECT * FROM ${tableName} WHERE id = ?`, [insert.id]);
}

async function updateQueuedItem(tableName, id, payload = {}) {
    const current = await get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);

    if (!current) {
        throw new Error(`${tableName} item not found.`);
    }

    const merged = {
        ...current,
        ...payload,
    };
    const job = normalizeJob(merged);

    if (!job.command) {
        throw new Error("Command is required.");
    }

    if (tableName === "startup") {
        await run(
            `UPDATE startup
             SET dir = ?, header = ?, command = ?, footer = ?, delay = ?, status = ?
             WHERE id = ?`,
            [
                job.dir,
                job.header,
                job.command,
                job.footer,
                Number(merged.delay || 0),
                normalizeText(merged.status || "pending", "pending"),
                id,
            ],
        );
    } else {
        await run(
            `UPDATE queue
             SET dir = ?, header = ?, command = ?, footer = ?, status = ?
             WHERE id = ?`,
            [
                job.dir,
                job.header,
                job.command,
                job.footer,
                normalizeText(merged.status || "pending", "pending"),
                id,
            ],
        );
    }

    return get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
}

async function updateItemStatus(tableName, id, status) {
    await run(`UPDATE ${tableName} SET status = ? WHERE id = ?`, [status, id]);
    return get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
}

async function deleteItem(tableName, id) {
    await run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
}

async function clearItems(tableName) {
    await run(`DELETE FROM ${tableName}`);
}

async function listHistory() {
    return all(`SELECT * FROM history ORDER BY timestamp DESC, id DESC`);
}

async function insertHistory(job, status, log) {
    const normalizedJob = normalizeJob(job);
    const insert = await run(
        `INSERT INTO history (dir, header, command, footer, status, log)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [normalizedJob.dir, normalizedJob.header, normalizedJob.command, normalizedJob.footer, status, log || ""],
    );

    return get(`SELECT * FROM history WHERE id = ?`, [insert.id]);
}

async function deleteHistory(id) {
    await run(`DELETE FROM history WHERE id = ?`, [id]);
}

async function clearHistory() {
    await run(`DELETE FROM history`);
}

async function listCommands(groupName) {
    if (groupName && groupName !== "All Commands") {
        return all(
            `SELECT * FROM commands WHERE group_name = ? ORDER BY timestamp DESC, id DESC`,
            [groupName],
        );
    }

    return all(`SELECT * FROM commands ORDER BY group_name ASC, timestamp DESC, id DESC`);
}

async function listCommandGroups() {
    const rows = await all(
        `SELECT DISTINCT group_name FROM commands WHERE TRIM(group_name) <> '' ORDER BY group_name ASC`,
    );

    return ["All Commands", ...rows.map((row) => row.group_name).filter((name) => name !== "All Commands")];
}

async function saveCommand(payload = {}) {
    const currentId = payload.id ? Number(payload.id) : null;
    const title = normalizeText(payload.title || payload.command);
    const groupName = normalizeText(payload.group_name || payload.group || "All Commands", "All Commands");
    const command = normalizeText(payload.command);

    if (!command) {
        throw new Error("Command is required.");
    }

    if (currentId) {
        await run(
            `UPDATE commands
             SET group_name = ?, title = ?, header = ?, command = ?, footer = ?
             WHERE id = ?`,
            [
                groupName,
                title,
                normalizeText(payload.header),
                command,
                normalizeText(payload.footer),
                currentId,
            ],
        );

        return get(`SELECT * FROM commands WHERE id = ?`, [currentId]);
    }

    const insert = await run(
        `INSERT INTO commands (group_name, title, header, command, footer)
         VALUES (?, ?, ?, ?, ?)`,
        [
            groupName,
            title,
            normalizeText(payload.header),
            command,
            normalizeText(payload.footer),
        ],
    );

    return get(`SELECT * FROM commands WHERE id = ?`, [insert.id]);
}

async function deleteCommand(id) {
    await run(`DELETE FROM commands WHERE id = ?`, [id]);
}

module.exports = {
    initDB,
    listQueue: () => listItems("queue"),
    createQueueItem: (payload) => createQueuedItem("queue", payload),
    updateQueueItem: (id, payload) => updateQueuedItem("queue", id, payload),
    updateQueueStatus: (id, status) => updateItemStatus("queue", id, status),
    deleteQueueItem: (id) => deleteItem("queue", id),
    clearQueue: () => clearItems("queue"),
    listStartup: () => listItems("startup"),
    createStartupItem: (payload) => createQueuedItem("startup", payload),
    updateStartupItem: (id, payload) => updateQueuedItem("startup", id, payload),
    updateStartupStatus: (id, status) => updateItemStatus("startup", id, status),
    deleteStartupItem: (id) => deleteItem("startup", id),
    clearStartup: () => clearItems("startup"),
    listHistory,
    insertHistory,
    deleteHistory,
    clearHistory,
    listCommands,
    listCommandGroups,
    saveCommand,
    deleteCommand,
};
