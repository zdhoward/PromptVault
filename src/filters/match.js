function promptMatchesRegex(prompt, compiled) {
    if (!compiled) return true;

    if (compiled.title && !compiled.title.test(prompt.title || '')) return false;
    if (compiled.content && !compiled.content.test(prompt.content || '')) return false;
    if (compiled.category && !compiled.category.test(prompt.category || '')) return false;

    if (compiled.tags) {
        const tagStr = (prompt.tags || []).map(t => t.name).join(' ');
        if (!compiled.tags.test(tagStr)) return false;
    }

    return true;
}

module.exports = { promptMatchesRegex };
