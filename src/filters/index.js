const { normalizeRegexFilters } = require('./normalize');
const { compileRegexFilters } = require('./compile');
const { promptMatchesRegex } = require('./match');

function buildFilterEngine() {
    return {
        normalizeRegexFilters,
        compileRegexFilters,
        promptMatchesRegex,
    };
}

module.exports = { buildFilterEngine };
