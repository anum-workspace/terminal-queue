const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "terminal-queue.db");
let db;

function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dir TEXT NOT NULL DEFAULT '~',
          header TEXT,
          command TEXT NOT NULL,
          footer TEXT,
          status TEXT DEFAULT 'pending',
          order_position INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
                db.run(`CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dir TEXT,
          header TEXT,
          command TEXT NOT NULL,
          footer TEXT,
          status TEXT,
          log TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
                db.run(`CREATE TABLE IF NOT EXISTS commands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_name TEXT DEFAULT 'All Commands',
          header TEXT,
          command TEXT NOT NULL,
          footer TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
                db.run(`CREATE TABLE IF NOT EXISTS startup (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dir TEXT NOT NULL DEFAULT '~',
          header TEXT,
          command TEXT NOT NULL,
          footer TEXT,
          delay INTEGER DEFAULT 0,
          order_position INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
                resolve();
            });
        });
    });
}

function getDb() {
    return db;
}
module.exports = { initDatabase, getDb };
