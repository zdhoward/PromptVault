// src/server.js

const { loadConfig } = require("./server/config");
const { createHttpServer } = require("./server/http");

const { openDatabase, buildRepositories } = require("./db");
const { buildFilterEngine } = require("./filters");
const { buildRoutes } = require("./api/routes");

function start() {
  // 1. Load configuration
  const config = loadConfig();

  // 2. Initialize persistence
  const db = openDatabase(config);
  const repos = buildRepositories(db);

  // 3. Initialize filter engine
  const filters = buildFilterEngine();

  // 4. Build API routes
  const routes = buildRoutes({
    repos,
    filters,
    config,
  });

  // 5. Create HTTP server
  const server = createHttpServer({
    routes,
    config,
  });

  // 6. Start listening
  server.listen(config.port, () => {
    console.log(`PromptVault listening on port ${config.port}`);
    console.log(`Database: ${config.dbPath}`);
    console.log(`Authentication: ${config.authUser ? "enabled" : "disabled"}`);
  });

  // 7. Graceful shutdown
  process.on("SIGTERM", () => {
    try {
      db.close();
    } catch {}
    server.close();
  });
}

start();
