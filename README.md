# PromptVault

<img width="1213" height="713" alt="image" src="https://github.com/user-attachments/assets/f9012ad2-f50d-44d9-bade-e807a5741fd6" />

PromptVault is a **self-hosted, local-first prompt and snippet management system** designed for people who want:

- full ownership of their data
- powerful search without SaaS complexity
- transparent storage
- a UI that feels like a local tool, not a website

It is intentionally **boring, durable, and explicit**.

---

## Core Characteristics

- **Single-user**
- **Self-hosted**
- **Runs on one port**
- **No cloud dependencies**
- **No build step**
- **No background jobs**
- **No hidden state**

PromptVault behaves more like a **local database with a UI** than a web app.

---

## Architecture Overview

```
Browser
   │
   ▼
Node.js Server (single port)
   ├── /api/*        → JSON API
   └── /*            → Static UI (index.html)
            │
            ▼
        SQLite Database
```

### Key Design Decisions

- UI and API are served from the **same Node process**
- All filtering logic is **server-side**
- The UI is static HTML with lightweight JS
- SQLite is used for durability and atomic writes
- Regex is the canonical filtering mechanism

---

## Data Storage

PromptVault uses **SQLite** for persistence:

- durable
- transactional
- easy to back up
- easy to inspect
- no migrations framework

No in-memory state is required to run the system.

---

## Query & Filter System (Important)

PromptVault uses a **regex-first filtering model**.

### Canonical Syntax

```
field:/pattern/flags
```

Supported fields:

- `tag`
- `cat` (category)
- `title`
- `content`

Examples:

```
tag:/^(nt8|nq)$/i
cat:/Trading|Research/
title:/EMA|VWAP/
content:/\bATR\b/
```

### How Filtering Works

- UI controls (tags, categories, search box) **compile into regex**
- Users do not need to write regex manually
- Saved Pages persist regex filters exactly
- Regex is applied server-side after SQL queries
- SQL handles sorting, pagination, and stats
- Regex handles expressive matching

Regex is the **single source of truth** for filtering.

---

## Pages (Saved Queries)

Pages are saved, named filter configurations.

- Pages store full regex filters
- Pages are selectable from the UI
- Pages can be deleted
- Pages do not mutate prompts
- Pages are safe to edit and restore

Think of Pages as **saved searches**, not folders.

---

## UI

- Static HTML
- Tailwind-styled
- Lightweight JavaScript (no framework build)
- Responsive
- Keyboard-friendly
- Designed to feel like a desktop tool

No hydration, no bundling, no runtime framework.

---

## Themes & Settings

PromptVault supports **runtime UI theming** via a dedicated Settings page.

### Theme System

- Themes are implemented using **CSS variables**
- Tailwind is used only for layout and structure
- Colors are defined in standalone CSS files

Themes live in:

```
public/themes/
```

Example:

```
dark.css
light.css
```

Changing themes:

- does **not** require rebuilding Tailwind
- does **not** inject inline styles
- works by swapping a single `<link>` tag

Users may add their own themes by dropping a new CSS file into this directory.

---

### Settings Persistence

UI settings (including the active theme) are stored in:

```
data/settings.json
```

This file is:

- human-readable
- safe to edit
- loaded at startup
- optional (defaults are used if missing)

Settings are intentionally kept **out of the database**.

---

## API

The API is intentionally narrow and boring.

Responsibilities:

- CRUD prompts
- Apply filters
- Return paginated results
- Enforce safe regex execution
- No caching
- No background processing

Authentication (if needed) is expected to be handled by a reverse proxy.

---

## Running PromptVault

### Requirements

- Node.js 16+
- No global dependencies required

### Start

```bash
node server.js
```

Then open:

```
http://localhost:3000
```

UI and API are available on the same port.

---

## Backups

Backing up PromptVault is trivial:

```bash
cp data/promptvault.db promptvault.backup.db
```

SQLite makes backups safe and fast.

---
