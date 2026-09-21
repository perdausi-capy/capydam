import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { searchDamAssetsTool, searchDamAssetsHandler } from './tools/searchAssets.js';
import { getMissingProjectsTool, getMissingProjectsHandler } from './tools/chaseUploads.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Require static Bearer Token (reuses CapyVault design)
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN;

app.use((req, res, next) => {
  // ✅ NEW: Bypass token check for local testing with MCP Inspector
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!BEARER_TOKEN) {
    console.warn("WARNING: MCP_BEARER_TOKEN is not set in environment.");
  } else if (!authHeader || authHeader !== `Bearer ${BEARER_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Initialize MCP Server
const server = new Server(
  {
    name: "capydam-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [searchDamAssetsTool, getMissingProjectsTool],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_dam_assets") {
    return await searchDamAssetsHandler(request.params.arguments);
  }
  if (request.params.name === "get_missing_projects") {
    return await getMissingProjectsHandler();
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

// MCP SSE Endpoints
let transport: SSEServerTransport | null = null;

app.get('/sse', async (req, res) => {
  try {
    if (transport) {
      await server.close();
    }
  } catch (e) {
    console.error("Error closing previous server connection:", e);
  }
  
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post('/message', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(500).send("SSE connection not established");
  }
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'capydam-mcp' });
});

app.listen(PORT, () => {
  console.log(`CapyDAM MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/message`);
});
