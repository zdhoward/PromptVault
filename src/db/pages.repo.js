module.exports = function pagesRepo(db) {
    function normalizePageFilters(filters) {
        if (!filters || typeof filters !== 'object') return {};
        const out = { ...filters };

        if (out.tags && typeof out.tags === 'string') {
            out.tags = out.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        if (!Array.isArray(out.tags)) out.tags = [];

        return out;
    }

    return {
        listPages() {
            const rows = db
                .prepare('SELECT * FROM pages ORDER BY name')
                .all();

            return rows.map(p => ({
                ...p,
                filters: normalizePageFilters(JSON.parse(p.filters)),
            }));
        },

        createPage(data) {
            const now = new Date().toISOString();
            const filters = normalizePageFilters(data.filters);

            const result = db
                .prepare(
                    'INSERT INTO pages (name, filters, created_at) VALUES (?, ?, ?)'
                )
                .run(data.name, JSON.stringify(filters), now);

            return {
                id: result.lastInsertRowid,
                name: data.name,
                filters,
                created_at: now,
            };
        },

        updatePage(id, data) {
            const filters = normalizePageFilters(data.filters);

            db.prepare(
                'UPDATE pages SET name = ?, filters = ? WHERE id = ?'
            ).run(data.name, JSON.stringify(filters), id);

            return true;
        },

        deletePage(id) {
            db.prepare('DELETE FROM pages WHERE id = ?').run(id);
            return true;
        },
    };
};
