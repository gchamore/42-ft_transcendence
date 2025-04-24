import Database from 'better-sqlite3';

// Créer la base de données SQLite
export function initializeDatabase(dbPath)
{
    const db = new Database(dbPath);
	// test
    // table users : id, username, password, avatar, settings, wins, losses
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT,
			avatar TEXT DEFAULT '/avatar/avatar.png',
			twofa_secret TEXT DEFAULT NULL,
            settings TEXT DEFAULT '{}',
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // table games : id, player1_id, player2_id, score_player1, score_player2, winner_id, date
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

    // table friendships : user_id, friend_id, date
    db.prepare(`
        CREATE TABLE IF NOT EXISTS friendships (
            user_id INTEGER,
            friend_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, friend_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id),
            CHECK (user_id != friend_id)
        )
    `).run();

    // table blocks : blocker_id, blocked_id, date
    db.prepare(`
        CREATE TABLE IF NOT EXISTS blocks (
            blocker_id INTEGER,
            blocked_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (blocker_id, blocked_id),
            FOREIGN KEY (blocker_id) REFERENCES users(id),
            FOREIGN KEY (blocked_id) REFERENCES users(id),
            CHECK (blocker_id != blocked_id)
        )
    `).run();

    return db;
}

