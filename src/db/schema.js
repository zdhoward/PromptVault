module.exports = `
    CREATE TABLE IF NOT EXISTS prompts (
                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                           title TEXT NOT NULL,
                                           content TEXT NOT NULL,
                                           category TEXT,
                                           rating INTEGER DEFAULT 0,
                                           is_featured INTEGER DEFAULT 0,
                                           created_at TEXT NOT NULL,
                                           updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_tags (
                                               prompt_id INTEGER NOT NULL,
                                               tag_id INTEGER NOT NULL,
                                               PRIMARY KEY (prompt_id, tag_id),
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

    CREATE TABLE IF NOT EXISTS pages (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         name TEXT UNIQUE NOT NULL,
                                         filters TEXT NOT NULL,
                                         created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
    CREATE INDEX IF NOT EXISTS idx_prompts_rating ON prompts(rating);
    CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
`;
