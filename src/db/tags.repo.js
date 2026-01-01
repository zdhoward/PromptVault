module.exports = function tagsRepo(db) {
    return {
        listTags() {
            return db
                .prepare('SELECT * FROM tags ORDER BY name')
                .all();
        },

        updateTag(id, name) {
            db.prepare('UPDATE tags SET name = ? WHERE id = ?')
                .run(name, id);
            return true;
        },
    };
};
