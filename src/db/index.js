const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const schema = require('./schema');

function openDatabase(config) {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(schema);
    return db;
}

function buildRepositories(db) {
    return {
        prompts: require('./prompts.repo')(db),
        tags: require('./tags.repo')(db),
        pages: require('./pages.repo')(db),
    };
}

module.exports = { openDatabase, buildRepositories };
