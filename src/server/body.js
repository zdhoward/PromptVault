function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

module.exports = { parseBody };
