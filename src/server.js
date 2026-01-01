// src/server.js

const { loadConfig } = require('./server/config');
const { createHttpServer } = require('./server/http');

const { openDatabase, buildRepositories } = require('./db');
const { buildFilterEngine } = require('./filters');
const { buildRoutes } = require('./api/routes');

function start() {
    const config = loadConfig();

    const db = openDatabase(config);
    const repos = buildRepositories(db);
    const filters = buildFilterEngine();

    const routes = buildRoutes({
        repos,
        filters,
        config,
    });

    const server = createHttpServer({
        routes,
        config,
    });

    server.listen(config.port, () => {
        console.log(`PromptVault listening on port ${config.port}`);
        console.log(`Database: ${config.dbPath}`);
        console.log(`Authentication: ${config.authUser ? 'enabled' : 'disabled'}`);
    });
}

start();
