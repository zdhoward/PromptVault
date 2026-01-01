function checkAuth(req, config) {
    if (!config.authUser || !config.authPass) return true;

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) return false;

    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':');
    return user === config.authUser && pass === config.authPass;
}

module.exports = { checkAuth };
