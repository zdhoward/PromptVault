function normalizeRegexFilters(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const k of ["title", "content", "tags", "category"]) {
    const v = raw[k];
    if (!v) continue;
    if (typeof v === "string") out[k] = { pattern: v, flags: "" };
    else if (typeof v === "object")
      out[k] = { pattern: v.pattern || "", flags: v.flags || "" };
  }
  return Object.keys(out).length ? out : null;
}

module.exports = { normalizeRegexFilters };
