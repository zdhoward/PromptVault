function buildSafeRegExp(pattern, flags = "") {
  if (!pattern || typeof pattern !== "string") return null;

  const allowed = new Set(["i", "m", "s", "u", "y"]);
  const cleanFlags = flags
    .split("")
    .filter((f) => allowed.has(f))
    .join("");

  try {
    return new RegExp(pattern, cleanFlags);
  } catch {
    throw new Error("Invalid regex");
  }
}

module.exports = { buildSafeRegExp };
