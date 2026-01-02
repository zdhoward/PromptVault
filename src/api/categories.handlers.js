function buildCategoriesHandlers({ repos }) {
    return {
        listCategories() {
            return {
                categories: repos.prompts.listCategories(),
            };
        },
    };
}

module.exports = { buildCategoriesHandlers };
