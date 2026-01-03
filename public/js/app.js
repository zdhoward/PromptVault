/* ============================================================================
   PromptVault — extracted JS from index.html (NO LOGIC CHANGES)
   Source: /mnt/data/index.html :contentReference[oaicite:0]{index=0}
   ============================================================================ */

/* =========================================================
   THEME PALETTE ENGINE (class-based only)
   ========================================================= */
(function () {
    const KEY = 'pv_theme_palette';
    const html = document.documentElement;

    function clearThemeClasses() {
        [...html.classList]
            .filter(c => c.startsWith('theme-'))
            .forEach(c => html.classList.remove(c));
    }

    function applyPalette(name) {
        clearThemeClasses();
        html.classList.add(`theme-${name}`);
    }

    // DEFAULT = dark
    const saved = localStorage.getItem(KEY) || 'dark';
    applyPalette(saved);

    window.PVThemePalette = {
        get() {
            return localStorage.getItem(KEY) || 'dark';
        },
        set(name) {
            localStorage.setItem(KEY, name);
            applyPalette(name);
        }
    };
})();

/* =========================================================
   ALPINE APP
   ========================================================= */
function promptVault() {
    return {
        prompts: [],
        categories: [],
        allTags: [],
        pages: [],
        activePage: null,
        viewMode: 'grid',
        loading: true,

        // Advanced filter UI
        filterQuery: '',
        filterJson: '',
        advancedOpen: false,

        filters: {
            search: '',
            category: '',
            tags: [],
            sort: 'newest',
            regex: null,
        },

        showEditor: false,
        editingPrompt: {},
        tagsInput: '',

        showPageEditor: false,
        newPageName: '',

        toast: {
            show: false,
            message: '',
        },

        showSettings: false,
        themePalette: window.PVThemePalette.get(),

        applyPalette(name) {
            window.PVThemePalette.set(name);
            this.themePalette = name;
        },

        openSettings() {
            if (window.PVThemePalette) {
                this.themePalette = window.PVThemePalette.get();
            }
            this.showSettings = true;
        },

        closeSettings() {
            this.showSettings = false;
        },

        defaultFilters() {
            return {
                search: '',
                category: '',
                tags: [],
                sort: 'newest',
                regex: null,
            };
        },

        async init() {
            await this.loadPrompts();
            await this.loadCategories();
            await this.loadTags();
            await this.loadPages();
            this.syncFilterQueryFromFilters();
            this.syncFilterJsonFromFilters();
        },

        normalizeRegexFilters(raw) {
            if (!raw || typeof raw !== 'object') return null;

            const out = {};
            for (const key of ['title', 'content', 'tags', 'category']) {
                if (!(key in raw)) continue;

                const v = raw[key];
                if (typeof v === 'string') {
                    out[key] = { pattern: v, flags: '' };
                    continue;
                }
                if (v && typeof v === 'object') {
                    const pattern = typeof v.pattern === 'string' ? v.pattern : '';
                    const flags = typeof v.flags === 'string' ? v.flags : '';
                    out[key] = { pattern, flags };
                    continue;
                }
            }

            if (!Object.keys(out).length) return null;
            return out;
        },

        parseFilterQueryText(text) {
            const patch = {
                search: '',
                category: '',
                tags: [],
                featured: false,
                minRating: undefined,
                maxRating: undefined,
                regex: null,
            };

            const tokens = (text || '').trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];

            const stripQuotes = (s) => {
                if (!s) return s;
                if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
                return s;
            };

            const escapeRegexLiteral = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const parseSlashRegex = (raw) => {
                if (!raw || raw[0] !== '/') return null;
                const lastSlash = raw.lastIndexOf('/');
                if (lastSlash <= 0) return null;
                const pattern = raw.slice(1, lastSlash);
                const flags = raw.slice(lastSlash + 1) || 'i';
                return { pattern, flags };
            };

            const rawTags = [];
            const rawCategories = [];
            let rawSearch = '';

            const regex = {};

            for (const t0 of tokens) {
                const t = stripQuotes(t0);

                const idx = t.indexOf(':');
                if (idx > 0) {
                    const key = t.slice(0, idx).toLowerCase();
                    const val = t.slice(idx + 1);

                    if (key === 'cat' || key === 'category') {
                        if (val === '*') {
                            regex.category = { pattern: '.*', flags: 'i' };
                            continue;
                        }
                        const rx = parseSlashRegex(val);
                        if (rx) regex.category = rx;
                        else if (val) rawCategories.push(val);
                        continue;
                    }

                    if (key === 'tag' || key === 'tags') {
                        if (val === '*') {
                            regex.tags = { pattern: '.*', flags: 'i' };
                            continue;
                        }
                        const rx = parseSlashRegex(val);
                        if (rx) regex.tags = rx;
                        else if (val) val.split(',').map(x => x.trim()).filter(Boolean).forEach(x => rawTags.push(x));
                        continue;
                    }

                    if (key === 'title' || key === 'content') {
                        if (val === '*') {
                            regex[key] = { pattern: '.*', flags: 'i' };
                            continue;
                        }
                        const rx = parseSlashRegex(val);
                        if (rx) regex[key] = rx;
                        else if (val) regex[key] = { pattern: escapeRegexLiteral(val), flags: 'i' };
                        continue;
                    }

                    if (key === 'q' || key === 'search') {
                        if (val) rawSearch += (rawSearch ? ' ' : '') + val;
                        continue;
                    }

                    if (key === 'featured') {
                        patch.featured = (val === '' || val === 'true' || val === '1' || val === 'yes');
                        continue;
                    }

                    if (key === 'min' || key === 'minrating') {
                        const n = parseInt(val, 10);
                        if (!Number.isNaN(n)) patch.minRating = n;
                        continue;
                    }

                    if (key === 'max' || key === 'maxrating') {
                        const n = parseInt(val, 10);
                        if (!Number.isNaN(n)) patch.maxRating = n;
                        continue;
                    }

                    if (key === 'rating') {
                        const m = val.match(/^(\d+)(?:-(\d+))?$/);
                        if (m) {
                            patch.minRating = parseInt(m[1], 10);
                            patch.maxRating = m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10);
                        }
                        continue;
                    }
                }

                if (t.toLowerCase() === 'featured') {
                    patch.featured = true;
                    continue;
                }

                rawSearch += (rawSearch ? ' ' : '') + t;
            }

            if (!regex.tags && rawTags.length) {
                const uniq = Array.from(new Set(rawTags));
                const escaped = uniq.map(escapeRegexLiteral);
                regex.tags = { pattern: `^(?:${escaped.join('|')})$`, flags: 'i' };
                patch.tags = uniq;
            }

            if (!regex.category && rawCategories.length) {
                const uniq = Array.from(new Set(rawCategories));
                const escaped = uniq.map(escapeRegexLiteral);
                regex.category = { pattern: `^(?:${escaped.join('|')})$`, flags: 'i' };
                patch.category = uniq.length === 1 ? uniq[0] : '';
            }

            if (rawSearch) {
                const escaped = escapeRegexLiteral(rawSearch);
                if (!regex.title) regex.title = { pattern: escaped, flags: 'i' };
                if (!regex.content) regex.content = { pattern: escaped, flags: 'i' };
                patch.search = rawSearch;
            }

            patch.regex = this.normalizeRegexFilters(regex);
            return patch;
        },

        buildFilterQueryText() {
            const escapeRegexLiteral = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const rx = this.normalizeRegexFilters(this.filters.regex) || {};
            const parts = [];

            if (rx.category?.pattern) {
                parts.push(`cat:/${rx.category.pattern}/${rx.category.flags || ''}`);
            } else if (this.filters.category) {
                const pat = `^(?:${escapeRegexLiteral(this.filters.category)})$`;
                parts.push(`cat:/${pat}/i`);
            }

            if (rx.tags?.pattern) {
                parts.push(`tag:/${rx.tags.pattern}/${rx.tags.flags || ''}`);
            } else if (Array.isArray(this.filters.tags) && this.filters.tags.length) {
                const uniq = Array.from(new Set(this.filters.tags));
                const pat = `^(?:${uniq.map(escapeRegexLiteral).join('|')})$`;
                parts.push(`tag:/${pat}/i`);
            }

            if (rx.title?.pattern) parts.push(`title:/${rx.title.pattern}/${rx.title.flags || ''}`);
            else if (this.filters.search) parts.push(`title:/${escapeRegexLiteral(this.filters.search)}/i`);

            if (rx.content?.pattern) parts.push(`content:/${rx.content.pattern}/${rx.content.flags || ''}`);
            else if (this.filters.search) parts.push(`content:/${escapeRegexLiteral(this.filters.search)}/i`);

            if (this.filters.featured) parts.push('featured');
            if (this.filters.minRating !== undefined && this.filters.minRating !== null && this.filters.minRating !== '') parts.push(`min:${this.filters.minRating}`);
            if (this.filters.maxRating !== undefined && this.filters.maxRating !== null && this.filters.maxRating !== '') parts.push(`max:${this.filters.maxRating}`);

            return parts.join(' ');
        },

        syncFilterQueryFromFilters() {
            this.filterQuery = this.buildFilterQueryText();
        },

        syncFilterJsonFromFilters() {
            const stable = {
                search: this.filters.search || '',
                category: this.filters.category || '',
                tags: Array.isArray(this.filters.tags) ? this.filters.tags : [],
                sort: this.filters.sort || 'newest',
                featured: !!this.filters.featured,
                minRating: this.filters.minRating,
                maxRating: this.filters.maxRating,
                regex: this.normalizeRegexFilters(this.filters.regex),
            };
            this.filterJson = JSON.stringify(stable, null, 2);
        },

        applyFilterQuery() {
            try {
                const patch = this.parseFilterQueryText(this.filterQuery);

                this.filters.search = patch.search ?? '';
                this.filters.category = patch.category ?? '';
                this.filters.tags = Array.isArray(patch.tags) ? patch.tags : [];
                this.filters.featured = !!patch.featured;
                this.filters.minRating = patch.minRating;
                this.filters.maxRating = patch.maxRating;
                this.filters.regex = patch.regex || null;

                this.activePage = null;
                this.syncFilterJsonFromFilters();
                this.applyFilters();
            } catch (e) {
                this.showToast('Invalid filter query');
            }
        },

        applyFilterJson() {
            try {
                const obj = JSON.parse(this.filterJson || '{}');
                this.filters.search = obj.search || '';
                this.filters.category = obj.category || '';
                this.filters.tags = Array.isArray(obj.tags) ? obj.tags : [];
                this.filters.sort = obj.sort || this.filters.sort || 'newest';
                this.filters.featured = !!obj.featured;
                this.filters.minRating = obj.minRating;
                this.filters.maxRating = obj.maxRating;
                this.filters.regex = this.normalizeRegexFilters(obj.regex);

                this.activePage = null;
                this.filterQuery = this.buildFilterQueryText();
                this.applyFilters();
            } catch {
                this.showToast('Invalid JSON');
            }
        },

        resetFilters() {
            this.filters = this.defaultFilters();
            this.syncFilterQueryFromFilters();
            this.syncFilterJsonFromFilters();
        },

        goAllPrompts() {
            this.activePage = null;
            this.resetFilters();
            this.applyFilters();
        },

        async loadPrompts() {
            this.loading = true;
            try {
                const params = new URLSearchParams();
                const rx = this.normalizeRegexFilters(this.filters.regex);

                if (!(rx && (rx.title || rx.content)) && this.filters.search) params.append('search', this.filters.search);
                if (!(rx && rx.category) && this.filters.category) params.append('category', this.filters.category);
                if (!(rx && rx.tags) && Array.isArray(this.filters.tags) && this.filters.tags.length) params.append('tags', this.filters.tags.join(','));

                params.append('sort', this.filters.sort);

                if (this.filters.featured) params.append('featured', 'true');
                if (this.filters.minRating !== undefined && this.filters.minRating !== null && this.filters.minRating !== '') params.append('minRating', String(this.filters.minRating));
                if (this.filters.maxRating !== undefined && this.filters.maxRating !== null && this.filters.maxRating !== '') params.append('maxRating', String(this.filters.maxRating));

                if (rx) params.append('regex', JSON.stringify(rx));

                const res = await fetch(`/api/prompts?${params}`);
                const data = await res.json();
                this.prompts = data.prompts || [];
                this.refreshTagsFromPrompts();
            } catch (err) {
                this.showToast('Failed to load prompts');
            }
            this.loading = false;
        },

        async loadCategories() {
            const res = await fetch('/api/categories');
            const data = await res.json();
            this.categories = data.categories;
        },

        async loadTags() {
            // Prefer truth from currently loaded prompts (prevents stale tags)
            this.refreshTagsFromPrompts();

            // If prompts are empty, fall back to API (optional)
            if (this.allTags.length > 0) return;

            try {
                const res = await fetch('/api/tags');
                const data = await res.json();
                const tags = data?.tags || [];
                this.allTags = tags
                    .map(t => (t && typeof t === 'object') ? t.name : t)
                    .filter(Boolean)
                    .map(name => String(name))
                    .sort((a, b) => a.localeCompare(b))
                    .map(name => ({ id: name, name }));
            } catch (_) {
                this.allTags = [];
            }
        },

        async loadPages() {
            const res = await fetch('/api/pages');
            const data = await res.json();
            const pages = data.pages || [];
            this.pages = pages.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        },

        refreshTagsFromPrompts() {
            const set = new Set();

            for (const p of (this.prompts || [])) {
                const tags = p?.tags || [];
                for (const t of tags) {
                    const name = (t && typeof t === 'object') ? t.name : t;
                    if (name) set.add(String(name));
                }
            }

            this.allTags = Array.from(set)
                .sort((a, b) => a.localeCompare(b))
                .map(name => ({ id: name, name }));
        },

        applyFilters() {
            this.loadPrompts();
        },

        _escapeRegexLiteral(s) {
            return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },

        _setRegexField(field, pattern, flags = 'i') {
            const base = this.filters.regex && typeof this.filters.regex === 'object' ? { ...this.filters.regex } : {};
            if (!pattern) delete base[field];
            else base[field] = { pattern, flags };
            this.filters.regex = this.normalizeRegexFilters(base);
        },

        _rebuildTagRegexFromSelection() {
            const tags = Array.isArray(this.filters.tags) ? this.filters.tags : [];
            if (!tags.length) {
                this._setRegexField('tags', null);
                return;
            }
            const uniq = Array.from(new Set(tags));
            const pat = `^(?:${uniq.map(this._escapeRegexLiteral).join('|')})$`;
            this._setRegexField('tags', pat, 'i');
        },

        onSearchChanged() {
            const s = (this.filters.search || '').trim();
            if (!s) {
                this._setRegexField('title', null);
                this._setRegexField('content', null);
            } else {
                const pat = this._escapeRegexLiteral(s);
                this._setRegexField('title', pat, 'i');
                this._setRegexField('content', pat, 'i');
            }
            this.activePage = null;
            this.syncFilterQueryFromFilters();
            this.syncFilterJsonFromFilters();
            this.applyFilters();
        },

        onCategoryChanged() {
            const c = (this.filters.category || '').trim();
            if (!c) {
                this._setRegexField('category', null);
            } else {
                const pat = `^(?:${this._escapeRegexLiteral(c)})$`;
                this._setRegexField('category', pat, 'i');
            }
            this.activePage = null;
            this.syncFilterQueryFromFilters();
            this.syncFilterJsonFromFilters();
            this.applyFilters();
        },

        toggleTag(tagName) {
            const tags = Array.isArray(this.filters.tags) ? [...this.filters.tags] : [];
            const idx = tags.indexOf(tagName);
            if (idx >= 0) tags.splice(idx, 1);
            else tags.push(tagName);

            this.filters.tags = tags;
            this._rebuildTagRegexFromSelection();

            this.activePage = null;
            this.syncFilterQueryFromFilters();
            this.syncFilterJsonFromFilters();
            this.applyFilters();
        },

        async copyPrompt(prompt) {
            try {
                await navigator.clipboard.writeText(prompt.content);
                this.showToast('✓ Copied to clipboard');
            } catch (err) {
                this.showToast('Failed to copy');
            }
        },

        openEditor(prompt = null) {
            if (prompt) {
                this.editingPrompt = {
                    ...prompt,
                    tags: (prompt.tags || []).map(t => t.name)
                };
                this.tagsInput = (prompt.tags || []).map(t => t.name).join(', ');
            } else {
                this.editingPrompt = {
                    title: '',
                    content: '',
                    category: '',
                    rating: 0,
                    is_featured: false,
                    tags: []
                };
                this.tagsInput = '';
            }
            this.showEditor = true;
        },

        closeEditor() {
            this.showEditor = false;
            this.editingPrompt = {};
            this.tagsInput = '';
        },

        updateTags() {
            this.editingPrompt.tags = this.tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);
        },

        async savePrompt() {
            if (!this.editingPrompt.title || !this.editingPrompt.content) {
                this.showToast('Title and content required');
                return;
            }

            const method = this.editingPrompt.id ? 'PUT' : 'POST';
            const url = this.editingPrompt.id ? `/api/prompts/${this.editingPrompt.id}` : '/api/prompts';

            try {
                await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.editingPrompt),
                });

                this.closeEditor();
                await this.loadPrompts();
                await this.loadCategories();
                await this.loadTags();
                this.showToast('✓ Prompt saved');
            } catch (err) {
                this.showToast('Failed to save prompt');
            }
        },

        async deletePrompt(id) {
            if (!confirm('Delete this prompt?')) return;

            try {
                await fetch(`/api/prompts/${id}`, { method: 'DELETE' });

                // Immediate UI update (no reliance on reload timing)
                if (Array.isArray(this.prompts)) {
                    this.prompts = this.prompts.filter(p => p && p.id !== id);
                }

                // Keep everything consistent (categories/tags may change)
                await this.loadCategories();
                await this.loadTags();

                this.showToast('✓ Prompt deleted');
            } catch (err) {
                this.showToast('Failed to delete prompt');
            }
        },

        async toggleFeatured(prompt) {
            if (!prompt || !prompt.id) return;

            const original = !!prompt.is_featured;
            prompt.is_featured = !original;

            try {
                // Normalize tags for API (modal uses string tags)
                const tags = Array.isArray(prompt.tags)
                    ? prompt.tags.map(t => (t && typeof t === 'object' ? t.name : t)).filter(Boolean)
                    : [];

                const payload = {
                    id: prompt.id,
                    title: prompt.title ?? '',
                    content: prompt.content ?? '',
                    category: prompt.category ?? '',
                    rating: Number(prompt.rating ?? 0),
                    tags,
                    is_featured: !!prompt.is_featured,
                };

                await fetch(`/api/prompts/${prompt.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                // Re-fetch so pinning/sorting stays authoritative
                await this.loadPrompts();
                this.showToast(prompt.is_featured ? '★ Featured' : '☆ Unfeatured');
            } catch (err) {
                // Roll back UI on failure
                prompt.is_featured = original;
                this.showToast('Failed to update featured');
            }
        },

        openPageEditor() {
            this.newPageName = '';
            this.showPageEditor = true;
        },

        closePageEditor() {
            this.showPageEditor = false;
            this.newPageName = '';
        },

        async savePage() {
            if (!this.newPageName) {
                this.showToast('Page name required');
                return;
            }

            try {
                await fetch('/api/pages', {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: this.newPageName,
                        filters: this.filters,
                    }),
                });

                this.closePageEditor();
                await this.loadPages();
                this.showToast('✓ Page created');
            } catch (err) {
                this.showToast('Failed to create page');
            }
        },

        async deletePage(page) {
            if (!page || !page.id) return;
            if (!confirm(`Delete page "${page.name}"?`)) return;

            try {
                await fetch(`/api/pages/${page.id}`, { method: 'DELETE' });
                await this.loadPages();

                if (this.activePage?.id === page.id) {
                    this.goAllPrompts();
                }

                this.showToast('✓ Page deleted');
            } catch (err) {
                this.showToast('Failed to delete page');
            }
        },

        loadPage(page) {
            this.activePage = page;

            const f = page.filters || {};
            this.filters = {
                ...this.defaultFilters(),
                ...f,
                tags: Array.isArray(f.tags) ? f.tags : [],
                regex: this.normalizeRegexFilters(f.regex),
            };

            this.filterQuery = this.buildFilterQueryText();
            this.syncFilterJsonFromFilters();
            this.applyFilters();
        },

        getPreview(content) {
            return content.substring(0, 120) + (content.length > 120 ? '...' : '');
        },

        isNew(prompt) {
            const created = new Date(prompt.created_at);
            const daysSince = (Date.now() - created) / (1000 * 60 * 60 * 24);
            return daysSince < 7;
        },

        showToast(message) {
            this.toast.message = message;
            this.toast.show = true;
            setTimeout(() => { this.toast.show = false; }, 2000);
        },
    };
}
