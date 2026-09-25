# 🔌 CapyDAM MCP — How It Works

> **Model Context Protocol (MCP)** lets AI assistants (like Claude, Cursor, or Windsurf) talk directly to CapyDAM — searching assets, spotting missing uploads, and more — without you copy-pasting anything.

---

## 🧑 For Non-Techies — The Plain English Version

**Think of MCP as a telephone line between your AI assistant and CapyDAM.**

Normally, if you ask Claude *"Which projects have no files uploaded?"*, it has no idea — it can only see what you paste into the chat.

With MCP turned on, Claude can **pick up the phone, call CapyDAM directly, and get the real answer** — live, from the actual database.

### What you can ask your AI once MCP is connected

| You ask the AI… | What actually happens |
|---|---|
| *"Find assets related to Dubai Holding"* | AI searches the CapyDAM library and returns real results |
| *"Which projects are missing uploads?"* | AI checks all collections and lists the empty ones |

That's it. You talk to the AI, the AI talks to CapyDAM, you get real answers. No copy-pasting, no switching tabs.

---

## 👩‍💻 For Techies — The Technical Version

### Architecture at a Glance

```
┌─────────────────┐      SSE / HTTP POST      ┌──────────────────────┐      REST API      ┌──────────────┐
│   AI Assistant  │ ◄────────────────────────► │  capydam-mcp Server  │ ──────────────────► │  CapyDAM API │
│ (Claude, etc.)  │                            │  (Express + MCP SDK) │                    │  :5000/api   │
└─────────────────┘                            └──────────────────────┘                    └──────────────┘
                                                      Port: 3000
```

### How a Request Flows (Step by Step)

1. **AI connects** → opens a persistent SSE stream to `GET /sse`
2. **AI asks** → sends a tool call via `POST /message` (e.g., `search_dam_assets`)
3. **MCP server routes** → matches the tool name and calls the handler
4. **Handler hits CapyDAM** → fires an authenticated REST request to `/api/assets` or `/api/collections`
5. **Response flows back** → formatted text travels back through SSE to the AI
6. **AI speaks** → presents the result to the user in plain language

### Transport: SSE (Server-Sent Events)

The MCP SDK uses **SSE** — a one-way persistent HTTP stream from server → client, with a separate `POST /message` channel for client → server. This avoids WebSocket complexity while keeping real-time communication.

```
AI → POST /message  →  MCP Server  →  CapyDAM API
AI ← GET  /sse      ←  MCP Server  ←  CapyDAM API
```

### Authentication

| Layer | Method |
|---|---|
| AI → MCP Server | `Authorization: Bearer <MCP_BEARER_TOKEN>` *(bypassed on localhost)* |
| MCP Server → CapyDAM API | `x-api-key: <CAPYDAM_API_KEY>` header |

### Registered Tools

#### `search_dam_assets`
- **What it does:** Full-text search on the CapyDAM asset library
- **Input:** `{ query: string }` — e.g., `"Dubai Holding procurement module"`
- **Calls:** `GET /api/assets?search=<query>&limit=10`
- **Returns:** List of matching files with name, MIME type, path, and owner ID

#### `get_missing_projects`
- **What it does:** Lists all Collections that have zero assets uploaded
- **Input:** None
- **Calls:** `GET /api/collections?targetUserId=all`
- **Returns:** Collection names + owner name/email for every empty collection

### Environment Variables

```env
PORT=3000                                   # Port the MCP server listens on
MCP_BEARER_TOKEN="..."                      # Token AI clients must send (skipped on localhost)
CAPYDAM_API_KEY="..."                       # Key used to authenticate with CapyDAM backend
CAPYDAM_API_URL="http://localhost:5000/api" # CapyDAM API base URL
```

### Key Files

| File | Role |
|---|---|
| `dist/server.js` | Express app, MCP SDK wiring, SSE endpoints, auth middleware |
| `dist/tools/searchAssets.js` | `search_dam_assets` tool definition + handler |
| `dist/tools/chaseUploads.js` | `get_missing_projects` tool definition + handler |

---

## 🚀 Quick Start

```bash
# 1. Make sure CapyDAM backend is running on :5000
# 2. Set your .env inside capydam-mcp/
# 3. Start the MCP server
cd capydam-mcp
node dist/server.js

# Verify it's alive
curl http://localhost:3000/health
# → { "status": "ok", "server": "capydam-mcp" }
```

Then point your AI assistant's MCP config to:
```
http://localhost:3000/sse
```

---

## 🔁 Adding a New Tool (Techies Only)

1. Create `dist/tools/myTool.js` — export a `toolDefinition` object and an async `handler(args)` function
2. Import both in `dist/server.js`
3. Add the definition to the `ListToolsRequestSchema` handler array
4. Add a `if (name === "my_tool")` branch to the `CallToolRequestSchema` handler

That's the full loop. No framework magic, just plain handler routing.
