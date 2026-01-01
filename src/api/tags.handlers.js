const { parseBody } = require('../server/body');

function buildTagsHandlers({ repos }) {
    return {
        listTags() {
            return { tags: repos.tags.listTags() };
        },

        async updateTag(req, res, params) {
            const body = await parseBody(req);
            if (!body.name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Name required' }));
                return null;
            }

            repos.tags.updateTag(params.id, body.name);
            return { success: true };
        },
    };
}

module.exports = { buildTagsHandlers };
