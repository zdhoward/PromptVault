const fs = require("fs");
const path = require("path");

function serveStatic(req, res, config) {
  let filePath = req.url.split("?")[0];
  if (filePath === "/") filePath = "/index.html";

  const resolved = path.join(config.publicDir, filePath);
  if (!resolved.startsWith(config.publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    const indexFile = path.join(config.publicDir, "index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(indexFile).pipe(res);
    return true;
  }

  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };

  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
  });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

module.exports = { serveStatic };
