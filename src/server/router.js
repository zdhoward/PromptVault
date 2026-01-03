function matchRoute(method, pathname, routes) {
  for (const route of routes) {
    if (route.method !== method) continue;

    const params = {};
    const pathParts = route.path.split("/").filter(Boolean);
    const urlParts = pathname.split("/").filter(Boolean);

    if (pathParts.length !== urlParts.length) continue;

    let match = true;
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].startsWith(":")) {
        params[pathParts[i].slice(1)] = urlParts[i];
      } else if (pathParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { handler: route.handler, params };
  }
  return null;
}

module.exports = { matchRoute };
