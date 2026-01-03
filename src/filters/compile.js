const { normalizeRegexFilters } = require("./normalize");
const { buildSafeRegExp } = require("./safe-regex");

function compileRegexFilters(raw) {
  const norm = normalizeRegexFilters(raw);
  if (!norm) return null;

  const compiled = {};
  for (const k of Object.keys(norm)) {
    const rx = buildSafeRegExp(norm[k].pattern, norm[k].flags);
    if (rx) compiled[k] = rx;
  }
  return Object.keys(compiled).length ? compiled : null;
}

module.exports = { compileRegexFilters };
