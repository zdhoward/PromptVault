function buildCategoriesHandlers({ repos }) {
    return {
        listCategories() {
            const rows = repos.prompts
                ._db
                .prepare(
                    'SELECT DISTINCT category FROM prompts WHERE category IS NOT NULL ORDER BY category'
                )
                .all();

            return { categories: rows.map(r => r.category) };
        },
    };
}

module.exports = { buildCategoriesHandlers };
