# PromptVault (Current State)

This README replaces older drafts and reflects the **actual implemented system**.

---

# PromptVault

PromptVault is a **self-hosted, local-first prompt and snippet management system** designed for people who want:

* full ownership of their data
* powerful search without SaaS complexity
* transparent storage
* a UI that feels like a local tool, not a website

It is intentionally **boring, durable, and explicit**.

---

## Core Characteristics

* **Single-user**
* **Self-hosted**
* **Runs on one port**
* **No cloud dependencies**
* **No build step**
* **No background jobs**
* **No hidden state**

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

* UI and API are served from the **same Node process**
* All filtering logic is **server-side**
* The UI is static HTML with lightweight JS
* SQLite is used for durability and atomic writes
* Regex is the canonical filtering mechanism

---

## Data Storage

PromptVault uses **SQLite** for persistence:

* durable
* transactional
* easy to back up
* easy to inspect
* no migrations framework

No in-memory state is required to run the system.

---

## Query & Filter System (Important)

PromptVault uses a **regex-first filtering model**.

### Canonical Syntax

```
field:/pattern/flags
```

Supported fields:

* `tag`
* `cat` (category)
* `title`
* `content`

Examples:

```
tag:/^(nt8|nq)$/i
cat:/Trading|Research/
title:/EMA|VWAP/
content:/\bATR\b/
```

### How Filtering Works

* UI controls (tags, categories, search box) **compile into regex**
* Users do not need to write regex manually
* Saved Pages persist regex filters exactly
* Regex is applied server-side after SQL queries
* SQL handles sorting, pagination, and stats
* Regex handles expressive matching

Regex is the **single source of truth** for filtering.

---

## Pages (Saved Queries)

Pages are saved, named filter configurations.

* Pages store full regex filters
* Pages are selectable from the UI
* Pages can be deleted
* Pages do not mutate prompts
* Pages are safe to edit and restore

Think of Pages as **saved searches**, not folders.

---

## UI

* Static HTML
* Tailwind-styled
* Lightweight JavaScript (no framework build)
* Responsive
* Keyboard-friendly
* Designed to feel like a desktop tool

No hydration, no bundling, no runtime framework.

---

## API

The API is intentionally narrow and boring.

Responsibilities:

* CRUD prompts
* Apply filters
* Return paginated results
* Enforce safe regex execution
* No caching
* No background processing

Authentication (if needed) is expected to be handled by a reverse proxy.

---

## Running PromptVault

### Requirements

* Node.js 16+
* No global dependencies required

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

## Philosophy

PromptVault is built on the following beliefs:

* **Simple systems last longer**
* **Regex is powerful when used intentionally**
* **Local tools should feel local**
* **State should be visible and inspectable**
* **Refactoring is cheaper than reinvention**

If the system feels boring, predictable, and stable — it is working as intended.