module.exports = function promptsRepo(db) {
  // --- Internal helpers (copied verbatim) ---

  function getPromptWithTags(id) {
    const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(id);

    if (!prompt) return null;

    const tags = db
      .prepare(
        `
                SELECT t.id, t.name
                FROM tags t
                         JOIN prompt_tags pt ON t.id = pt.tag_id
                WHERE pt.prompt_id = ?
            `
      )
      .all(id);

    return {
      ...prompt,
      tags,
      is_featured: Boolean(prompt.is_featured),
    };
  }

  function upsertTags(tagNames) {
    const tagIds = [];

    const insertTag = db.prepare(
      "INSERT OR IGNORE INTO tags (name) VALUES (?)"
    );
    const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");

    for (const name of tagNames) {
      insertTag.run(name);
      const tag = getTag.get(name);
      tagIds.push(tag.id);
    }

    return tagIds;
  }

  function getAllPromptsWithTags(filters, filterEngine) {
    let query = "SELECT DISTINCT p.* FROM prompts p";
    const params = [];
    const conditions = [];

    // Join tags if filtering by tags
    if (filters.tags && filters.tags.length > 0) {
      query +=
        " JOIN prompt_tags pt ON p.id = pt.prompt_id" +
        " JOIN tags t ON pt.tag_id = t.id";
      conditions.push(`t.name IN (${filters.tags.map(() => "?").join(",")})`);
      params.push(...filters.tags);
    }

    // Category filter
    if (filters.category) {
      conditions.push("p.category = ?");
      params.push(filters.category);
    }

    // Rating filters
    if (filters.minRating !== undefined) {
      conditions.push("p.rating >= ?");
      params.push(filters.minRating);
    }

    if (filters.maxRating !== undefined) {
      conditions.push("p.rating <= ?");
      params.push(filters.maxRating);
    }

    // Search (LIKE-based)
    if (filters.search) {
      conditions.push("(p.title LIKE ? OR p.content LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    // Featured filter
    if (filters.featured) {
      conditions.push("p.is_featured = 1");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Sorting
    const sortMap = {
      newest: "p.created_at DESC",
      oldest: "p.created_at ASC",
      rating: "p.rating DESC",
      alpha: "p.title ASC",
    };

    query +=
      " ORDER BY p.is_featured DESC, " +
      (sortMap[filters.sort] || sortMap.newest);

    const compiledRegex = filterEngine.compileRegexFilters(filters.regex);

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    if (!compiledRegex) {
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);
    } else {
      // Cap rows before regex filtering
      query += " LIMIT 5000";
    }

    const rows = db.prepare(query).all(...params);

    let enriched = rows.map((prompt) => {
      const tags = db
        .prepare(
          `
                    SELECT t.id, t.name
                    FROM tags t
                             JOIN prompt_tags pt ON t.id = pt.tag_id
                    WHERE pt.prompt_id = ?
                `
        )
        .all(prompt.id);

      return {
        ...prompt,
        tags,
        is_featured: Boolean(prompt.is_featured),
      };
    });

    if (compiledRegex) {
      enriched = enriched.filter((p) =>
        filterEngine.promptMatchesRegex(p, compiledRegex)
      );
      enriched = enriched.slice(offset, offset + limit);
    }

    return enriched;
  }

  // --- Public API ---

  return {
    getPromptById(id) {
      return getPromptWithTags(id);
    },

    listPrompts(filters, filterEngine) {
      return getAllPromptsWithTags(filters, filterEngine);
    },

    createPrompt(data) {
      const now = new Date().toISOString();

      const result = db
        .prepare(
          `
                    INSERT INTO prompts
                        (title, content, category, rating, is_featured, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `
        )
        .run(
          data.title,
          data.content,
          data.category || null,
          data.rating || 0,
          data.is_featured ? 1 : 0,
          now,
          now
        );

      const promptId = result.lastInsertRowid;

      if (data.tags && data.tags.length > 0) {
        const tagIds = upsertTags(data.tags);
        const insertPromptTag = db.prepare(
          "INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)"
        );

        for (const tagId of tagIds) {
          insertPromptTag.run(promptId, tagId);
        }
      }

      return getPromptWithTags(promptId);
    },

    updatePrompt(id, data) {
      const existing = db
        .prepare("SELECT id FROM prompts WHERE id = ?")
        .get(id);

      if (!existing) return null;

      const now = new Date().toISOString();

      db.prepare(
        `
                UPDATE prompts
                SET title = ?, content = ?, category = ?, rating = ?, is_featured = ?, updated_at = ?
                WHERE id = ?
            `
      ).run(
        data.title,
        data.content,
        data.category || null,
        data.rating || 0,
        data.is_featured ? 1 : 0,
        now,
        id
      );

      db.prepare("DELETE FROM prompt_tags WHERE prompt_id = ?").run(id);

      if (data.tags && data.tags.length > 0) {
        const tagIds = upsertTags(data.tags);
        const insertPromptTag = db.prepare(
          "INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)"
        );

        for (const tagId of tagIds) {
          insertPromptTag.run(id, tagId);
        }
      }

      return getPromptWithTags(id);
    },

    deletePrompt(id) {
      const result = db.prepare("DELETE FROM prompts WHERE id = ?").run(id);

      return result.changes > 0;
    },

    // used by /api/categories
    listCategories() {
      return db
        .prepare(
          "SELECT DISTINCT category FROM prompts WHERE category IS NOT NULL ORDER BY category"
        )
        .all()
        .map((r) => r.category);
    },
  };
};
