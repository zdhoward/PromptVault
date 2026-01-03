const http = require("http");
const { applyCors } = require("./cors");
const { checkAuth } = require("./auth");
const { serveStatic } = require("./static");
const { matchRoute } = require("./router");

function createHttpServer({ routes, config }) {
  return http.createServer(async (req, res) => {
    applyCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!checkAuth(req, config)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="PromptVault"' });
      res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    const [pathname, search] = req.url.split("?");
    const query = {};
    if (search) {
      new URLSearchParams(search).forEach((v, k) => (query[k] = v));
    }

    if (!pathname.startsWith("/api")) {
      if (serveStatic(req, res, config)) return;
    }

    const route = matchRoute(req.method, pathname, routes);
    if (!route) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const result = await route.handler(req, res, route.params, query);
      if (result !== null) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

module.exports = { createHttpServer };
