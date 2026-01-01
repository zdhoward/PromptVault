const { buildPromptsHandlers } = require('./prompts.handlers');
const { buildPagesHandlers } = require('./pages.handlers');
const { buildTagsHandlers } = require('./tags.handlers');
const { buildCategoriesHandlers } = require('./categories.handlers');

function buildRoutes({ repos, filters }) {
    const prompts = buildPromptsHandlers({ repos, filters });
    const pages = buildPagesHandlers({ repos });
    const tags = buildTagsHandlers({ repos });
    const categories = buildCategoriesHandlers({ repos });

    return [
        // Prompts
        { method: 'GET',    path: '/api/prompts',       handler: prompts.listPrompts },
        { method: 'GET',    path: '/api/prompts/:id',   handler: prompts.getPrompt },
        { method: 'POST',   path: '/api/prompts',       handler: prompts.createPrompt },
        { method: 'PUT',    path: '/api/prompts/:id',   handler: prompts.updatePrompt },
        { method: 'DELETE', path: '/api/prompts/:id',   handler: prompts.deletePrompt },

        // Pages
        { method: 'GET',    path: '/api/pages',         handler: pages.listPages },
        { method: 'POST',   path: '/api/pages',         handler: pages.createPage },
        { method: 'PUT',    path: '/api/pages/:id',     handler: pages.updatePage },
        { method: 'DELETE', path: '/api/pages/:id',     handler: pages.deletePage },

        // Tags
        { method: 'GET',    path: '/api/tags',          handler: tags.listTags },
        { method: 'PUT',    path: '/api/tags/:id',      handler: tags.updateTag },

        // Categories
        { method: 'GET',    path: '/api/categories',    handler: categories.listCategories },
    ];
}

module.exports = { buildRoutes };
