const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'promptvault.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUTH_USER = process.env.AUTH_USER || '';
const AUTH_PASS = process.env.AUTH_PASS || '';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create schema
db.exec(`
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
`);

// HTTP Basic Auth
function checkAuth(req) {
    if (!AUTH_USER || !AUTH_PASS) return true;

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) return false;

    const credentials = Buffer.from(auth.slice(6), 'base64').toString();
    const [user, pass] = credentials.split(':');
    return user === AUTH_USER && pass === AUTH_PASS;
}

// Parse request body
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Regex filters (standardized)
 *
 * Supported shape (recommended):
 *   {
 *     title:   { pattern: "EMA|VWAP", flags: "i" },
 *     content: { pattern: "\\bfoo\\b", flags: "i" },
 *     tags:    { pattern: "^nq", flags: "i" }
 *   }
 *
 * Backward-compatible accepted shapes:
 *   - title/content/tags as a string => treated as {pattern: <string>, flags:""}
 *   - query param "regex" as JSON string for the object above
 */
function normalizeRegexFilters(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const out = {};
    for (const key of ['title', 'content', 'tags', 'category']) {
        if (!(key in raw)) continue;

        const v = raw[key];
        if (typeof v === 'string') {
            out[key] = { pattern: v, flags: '' };
            continue;
        }
        if (v && typeof v === 'object') {
            const pattern = typeof v.pattern === 'string' ? v.pattern : '';
            const flags = typeof v.flags === 'string' ? v.flags : '';
            out[key] = { pattern, flags };
            continue;
        }
    }

    if (Object.keys(out).length === 0) return null;
    return out;
}

function parseRegexQueryParam(regexParam) {
    if (!regexParam) return null;
    if (typeof regexParam !== 'string') return null;

    // URLSearchParams already decoded it; still guard length.
    if (regexParam.length > 5000) {
        throw new Error('Regex filter too large');
    }

    let parsed;
    try {
        parsed = JSON.parse(regexParam);
    } catch {
        throw new Error('Invalid regex JSON');
    }
    return normalizeRegexFilters(parsed);
}

function buildSafeRegExp(pattern, flags) {
    const maxPatternLen = 400;
    if (typeof pattern !== 'string') return null;

    const trimmed = pattern.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxPatternLen) {
        throw new Error('Regex pattern too long');
    }

    // Only allow safe-ish flags; no "g" needed for .test, and keeping it off avoids statefulness.
    const allowedFlags = new Set(['i', 'm', 's', 'u', 'y']);
    const cleanFlags = (flags || '')
        .split('')
        .filter(ch => allowedFlags.has(ch))
        .join('');

    try {
        return new RegExp(trimmed, cleanFlags);
    } catch {
        throw new Error('Invalid regex pattern');
    }
}

function compileRegexFilters(regexFilters) {
    const norm = normalizeRegexFilters(regexFilters);
    if (!norm) return null;

    const compiled = {};
    for (const key of Object.keys(norm)) {
        const { pattern, flags } = norm[key] || {};
        const rx = buildSafeRegExp(pattern, flags);
        if (rx) compiled[key] = rx;
    }

    if (Object.keys(compiled).length === 0) return null;
    return compiled;
}

function promptMatchesRegex(prompt, compiled) {
    if (!compiled) return true;

    if (compiled.title) {
        const title = (prompt.title || '').toString();
        if (!compiled.title.test(title)) return false;
    }

    if (compiled.content) {
        const content = (prompt.content || '').toString();
        if (!compiled.content.test(content)) return false;
    }

    if (compiled.category) {
        const cat = (prompt.category || '').toString();
        if (!compiled.category.test(cat)) return false;
    }

    if (compiled.tags) {
        const tagNames = (prompt.tags || []).map(t => (t && t.name ? t.name : '')).join(' ');
        if (!compiled.tags.test(tagNames)) return false;
    }

    return true;
}

// Database helpers
function getPromptWithTags(id) {
    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
    if (!prompt) return null;

    const tags = db.prepare(`
        SELECT t.id, t.name
        FROM tags t
                 JOIN prompt_tags pt ON t.id = pt.tag_id
        WHERE pt.prompt_id = ?
    `).all(id);

    return { ...prompt, tags, is_featured: Boolean(prompt.is_featured) };
}

function getAllPromptsWithTags(filters = {}) {
    let query = 'SELECT DISTINCT p.* FROM prompts p';
    const params = [];
    const conditions = [];

    // Join tags if filtering by tags
    if (filters.tags && filters.tags.length > 0) {
        query += ' JOIN prompt_tags pt ON p.id = pt.prompt_id JOIN tags t ON pt.tag_id = t.id';
        conditions.push(`t.name IN (${filters.tags.map(() => '?').join(',')})`);
        params.push(...filters.tags);
    }

    // Category filter
    if (filters.category) {
        conditions.push('p.category = ?');
        params.push(filters.category);
    }

    // Rating filter
    if (filters.minRating !== undefined) {
        conditions.push('p.rating >= ?');
        params.push(filters.minRating);
    }
    if (filters.maxRating !== undefined) {
        conditions.push('p.rating <= ?');
        params.push(filters.maxRating);
    }

    // Search
    if (filters.search) {
        conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
    }

    // Featured filter
    if (filters.featured) {
        conditions.push('p.is_featured = 1');
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sorting
    const sortMap = {
        newest: 'p.created_at DESC',
        oldest: 'p.created_at ASC',
        rating: 'p.rating DESC',
        alpha: 'p.title ASC',
    };

    // Always pin featured to the top (unless you're already filtering to only featured; still harmless).
    query += ' ORDER BY p.is_featured DESC, ' + (sortMap[filters.sort] || sortMap.newest);

    const compiledRegex = compileRegexFilters(filters.regex);

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // If regex is in play, we need to paginate AFTER applying regex (because regex isn't in SQL).
    // We'll cap to a reasonable max to avoid loading the world.
    if (!compiledRegex) {
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
    } else {
        const maxRows = 5000;
        query += ` LIMIT ${maxRows}`;
    }

    const prompts = db.prepare(query).all(...params);

    // Attach tags to each prompt
    let enriched = prompts.map(prompt => {
        const tags = db.prepare(`
            SELECT t.id, t.name
            FROM tags t
                     JOIN prompt_tags pt ON t.id = pt.tag_id
            WHERE pt.prompt_id = ?
        `).all(prompt.id);

        return { ...prompt, tags, is_featured: Boolean(prompt.is_featured) };
    });

    // Regex filtering (standardized)
    if (compiledRegex) {
        enriched = enriched.filter(p => promptMatchesRegex(p, compiledRegex));
        enriched = enriched.slice(offset, offset + limit);
    }

    return enriched;
}

function upsertTags(tagNames) {
    const tagIds = [];
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');

    for (const name of tagNames) {
        insertTag.run(name);
        const tag = getTag.get(name);
        tagIds.push(tag.id);
    }

    return tagIds;
}

function normalizePageFilters(filters) {
    if (!filters || typeof filters !== 'object') return {};
    const out = { ...filters };

    // Ensure tags is always an array (UI can send empty string in some cases)
    if (out.tags && typeof out.tags === 'string') {
        out.tags = out.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(out.tags)) out.tags = [];

    // Normalize regex
    out.regex = normalizeRegexFilters(out.regex);

    return out;
}

// Routes
const routes = {
    'GET /api/prompts': (req, res, params, query) => {
        const filters = {
            search: query.search,
            category: query.category,
            tags: query.tags ? query.tags.split(',') : undefined,
            minRating: query.minRating ? parseInt(query.minRating) : undefined,
            maxRating: query.maxRating ? parseInt(query.maxRating) : undefined,
            featured: query.featured === 'true',
            sort: query.sort,
            limit: query.limit ? parseInt(query.limit) : undefined,
            offset: query.offset ? parseInt(query.offset) : undefined,
        };

        // Standardized regex filter via JSON string query param "regex"
        if (query.regex) {
            filters.regex = parseRegexQueryParam(query.regex);
        }

        const prompts = getAllPromptsWithTags(filters);
        return { prompts };
    },

    'GET /api/prompts/:id': (req, res, params) => {
        const prompt = getPromptWithTags(params.id);
        if (!prompt) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prompt not found' }));
            return null;
        }
        return { prompt };
    },

    'POST /api/prompts': async (req, res) => {
        const body = await parseBody(req);

        if (!body.title || !body.content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Title and content required' }));
            return null;
        }

        const now = new Date().toISOString();
        const result = db.prepare(`
            INSERT INTO prompts (title, content, category, rating, is_featured, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            body.title,
            body.content,
            body.category || null,
            body.rating || 0,
            body.is_featured ? 1 : 0,
            now,
            now
        );

        const promptId = result.lastInsertRowid;

        // Add tags
        if (body.tags && body.tags.length > 0) {
            const tagIds = upsertTags(body.tags);
            const insertPromptTag = db.prepare('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
            for (const tagId of tagIds) {
                insertPromptTag.run(promptId, tagId);
            }
        }

        return { prompt: getPromptWithTags(promptId) };
    },

    'PUT /api/prompts/:id': async (req, res, params) => {
        const body = await parseBody(req);
        const promptId = params.id;

        const existing = db.prepare('SELECT id FROM prompts WHERE id = ?').get(promptId);
        if (!existing) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prompt not found' }));
            return null;
        }

        if (!body.title || !body.content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Title and content required' }));
            return null;
        }

        const now = new Date().toISOString();
        db.prepare(`
            UPDATE prompts
            SET title = ?, content = ?, category = ?, rating = ?, is_featured = ?, updated_at = ?
            WHERE id = ?
        `).run(
            body.title,
            body.content,
            body.category || null,
            body.rating || 0,
            body.is_featured ? 1 : 0,
            now,
            promptId
        );

        // Update tags
        db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(promptId);
        if (body.tags && body.tags.length > 0) {
            const tagIds = upsertTags(body.tags);
            const insertPromptTag = db.prepare('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
            for (const tagId of tagIds) {
                insertPromptTag.run(promptId, tagId);
            }
        }

        return { prompt: getPromptWithTags(promptId) };
    },

    'DELETE /api/prompts/:id': (req, res, params) => {
        const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(params.id);
        if (result.changes === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prompt not found' }));
            return null;
        }
        return { success: true };
    },

    'GET /api/categories': () => {
        const categories = db.prepare('SELECT DISTINCT category FROM prompts WHERE category IS NOT NULL ORDER BY category').all();
        return { categories: categories.map(c => c.category) };
    },

    'GET /api/tags': () => {
        const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
        return { tags };
    },

    'PUT /api/tags/:id': async (req, res, params) => {
        const body = await parseBody(req);
        if (!body.name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name required' }));
            return null;
        }

        db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(body.name, params.id);
        return { success: true };
    },

    'GET /api/pages': () => {
        const pages = db.prepare('SELECT * FROM pages ORDER BY name').all();
        return {
            pages: pages.map(p => ({
                ...p,
                filters: normalizePageFilters(JSON.parse(p.filters))
            }))
        };
    },

    'POST /api/pages': async (req, res) => {
        const body = await parseBody(req);
        if (!body.name || !body.filters) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name and filters required' }));
            return null;
        }

        const now = new Date().toISOString();
        const filters = normalizePageFilters(body.filters);

        const result = db.prepare('INSERT INTO pages (name, filters, created_at) VALUES (?, ?, ?)').run(
            body.name,
            JSON.stringify(filters),
            now
        );

        return { page: { id: result.lastInsertRowid, name: body.name, filters, created_at: now } };
    },

    'PUT /api/pages/:id': async (req, res, params) => {
        const body = await parseBody(req);
        if (!body.name || !body.filters) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name and filters required' }));
            return null;
        }

        const filters = normalizePageFilters(body.filters);

        db.prepare('UPDATE pages SET name = ?, filters = ? WHERE id = ?').run(
            body.name,
            JSON.stringify(filters),
            params.id
        );

        return { success: true };
    },

    'DELETE /api/pages/:id': (req, res, params) => {
        db.prepare('DELETE FROM pages WHERE id = ?').run(params.id);
        return { success: true };
    },
};

// Request router
function matchRoute(method, pathname) {
    for (const [routeKey, handler] of Object.entries(routes)) {
        const [routeMethod, routePath] = routeKey.split(' ');
        if (method !== routeMethod) continue;

        const pathParts = routePath.split('/').filter(Boolean);
        const urlParts = pathname.split('/').filter(Boolean);

        if (pathParts.length !== urlParts.length) continue;

        const params = {};
        let match = true;

        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i].startsWith(':')) {
                params[pathParts[i].slice(1)] = urlParts[i];
            } else if (pathParts[i] !== urlParts[i]) {
                match = false;
                break;
            }
        }

        if (match) return { handler, params };
    }
    return null;
}

function serveStatic(req, res) {
    let filePath = req.url.split('?')[0];

    if (filePath === '/') filePath = '/index.html';

    const resolved = path.join(PUBLIC_DIR, filePath);

    // Prevent path traversal
    if (!resolved.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return true;
    }

    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        return false; // let SPA fallback handle it
    }

    const ext = path.extname(resolved).toLowerCase();
    const types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.json': 'application/json'
    };

    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
    return true;
}


// Request handler
async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (!checkAuth(req)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="PromptVault"' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
    }

    const [pathname, search] = req.url.split('?');
    const query = {};
    if (search) {
        new URLSearchParams(search).forEach((value, key) => {
            query[key] = value;
        });
    }

    // Serve UI files unless this is an API call
    if (!pathname.startsWith('/api')) {
        if (serveStatic(req, res)) return;

        // SPA fallback → index.html
        const indexFile = path.join(PUBLIC_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexFile).pipe(res);
        return;
    }

    const route = matchRoute(req.method, pathname);
    if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    try {
        const result = await route.handler(req, res, route.params, query);
        if (result !== null) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        }
    } catch (err) {
        console.error('Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
}

// Start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`PromptVault API listening on port ${PORT}`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`Authentication: ${AUTH_USER ? 'enabled' : 'disabled'}`);
});

process.on('SIGTERM', () => {
    db.close();
    server.close();
});
