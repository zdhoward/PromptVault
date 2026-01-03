const path = require("path");

function loadConfig() {
  return {
    port: process.env.PORT || 3000,
    dbPath:
      process.env.DB_PATH || path.join(process.cwd(), "data", "promptvault.db"),
    publicDir: path.join(process.cwd(), "public"),
    authUser: process.env.AUTH_USER || "",
    authPass: process.env.AUTH_PASS || "",
  };
}

module.exports = { loadConfig };
