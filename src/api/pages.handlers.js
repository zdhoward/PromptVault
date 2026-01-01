const { parseBody } = require('../server/body');

function buildPagesHandlers({ repos }) {
    return {
        listPages() {
            return { pages: repos.pages.listPages() };
        },

        async createPage(req, res) {
            const body = await parseBody(req);
            if (!body.name || !body.filters) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Name and filters required' }));
                return null;
            }

            const page = repos.pages.createPage(body);
            return { page };
        },

        async updatePage(req, res, params) {
            const body = await parseBody(req);
            if (!body.name || !body.filters) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Name and filters required' }));
                return null;
            }

            repos.pages.updatePage(params.id, body);
            return { success: true };
        },

        deletePage(req, res, params) {
            repos.pages.deletePage(params.id);
            return { success: true };
        },
    };
}

module.exports = { buildPagesHandlers };
