const { parseBody } = require("../server/body");

function buildPromptsHandlers({ repos, filters }) {
  return {
    // GET /api/prompts
    listPrompts(req, res, params, query) {
      const filterArgs = {
        search: query.search,
        category: query.category,
        tags: query.tags ? query.tags.split(",") : undefined,
        minRating: query.minRating ? parseInt(query.minRating, 10) : undefined,
        maxRating: query.maxRating ? parseInt(query.maxRating, 10) : undefined,
        featured: query.featured === "true",
        sort: query.sort,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      };

      // Regex filter via JSON string
      if (query.regex) {
        try {
          filterArgs.regex = JSON.parse(query.regex);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid regex JSON" }));
          return null;
        }
      }

      const prompts = repos.prompts.listPrompts(filterArgs, filters);
      return { prompts };
    },

    // GET /api/prompts/:id
    getPrompt(req, res, params) {
      const prompt = repos.prompts.getPromptById(params.id);
      if (!prompt) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Prompt not found" }));
        return null;
      }
      return { prompt };
    },

    // POST /api/prompts
    async createPrompt(req, res) {
      const body = await parseBody(req);

      if (!body.title || !body.content) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Title and content required" }));
        return null;
      }

      const prompt = repos.prompts.createPrompt(body);
      return { prompt };
    },

    // PUT /api/prompts/:id
    async updatePrompt(req, res, params) {
      const body = await parseBody(req);

      if (!body.title || !body.content) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Title and content required" }));
        return null;
      }

      const prompt = repos.prompts.updatePrompt(params.id, body);
      if (!prompt) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Prompt not found" }));
        return null;
      }

      return { prompt };
    },

    // DELETE /api/prompts/:id
    deletePrompt(req, res, params) {
      const ok = repos.prompts.deletePrompt(params.id);
      if (!ok) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Prompt not found" }));
        return null;
      }
      return { success: true };
    },
  };
}

module.exports = { buildPromptsHandlers };
