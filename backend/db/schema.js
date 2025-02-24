const Database = require("better-sqlite3");

function initializeDatabase(dbPath)
{
    const db = new Database(dbPath);

    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            avatar TEXT DEFAULT NULL,
            settings TEXT DEFAULT '{}',
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER,
            player2_id INTEGER,
            score_player1 INTEGER DEFAULT 0,
            score_player2 INTEGER DEFAULT 0,
            winner_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player1_id) REFERENCES users(id),
            FOREIGN KEY (player2_id) REFERENCES users(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )
    `).run();

    return db;
}

module.exports = initializeDatabase;
