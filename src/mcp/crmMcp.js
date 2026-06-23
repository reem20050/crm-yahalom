// ============================================================
// MCP (Model Context Protocol) server for the CRM
// ------------------------------------------------------------
// Exposes the existing CRM REST API to AI agents (e.g. "Hermes")
// as MCP tools, over a minimal Streamable-HTTP / JSON-RPC endpoint.
//
// Design:
//   * Mounted at /mcp (see index.js). Stateless – each POST is a
//     self-contained JSON-RPC request (or batch).
//   * Auth: a single shared bearer token from env MCP_API_TOKEN.
//     If the env var is missing the endpoint is disabled (503).
//   * Tools proxy to the internal REST API (http://127.0.0.1:PORT/api)
//     using a short-lived service JWT for an admin user, so ALL the
//     existing validation / business logic / permissions are reused.
//
// No extra npm dependencies – only express, jsonwebtoken, axios, crypto.
// All heavy modules (db, route modules) are required lazily so this
// file is cheap and safe to load.
// ============================================================

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const router = express.Router();

const SERVER_INFO = { name: 'crm-yahalom-mcp', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2024-11-05';

// ---- helpers ---------------------------------------------------

function internalBaseUrl() {
  return `http://127.0.0.1:${process.env.PORT || 5000}/api`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch (_e) {
    return false;
  }
}

// Mint (and cache) a short-lived service JWT for an admin user, so the
// internal REST calls pass the normal authenticateToken middleware.
let _cachedToken = null;
let _cachedExp = 0; // epoch ms
async function getServiceToken() {
  const now = Date.now();
  if (_cachedToken && now < _cachedExp - 60 * 1000) return _cachedToken;

  const db = require('../config/database');
  // Prefer the seeded admin, fall back to any admin user.
  let row = null;
  try {
    const r = await db.query(
      "SELECT id, role FROM users WHERE email = $1 LIMIT 1",
      ['admin@tzevetyahalom.co.il']
    );
    if (r.rows.length) row = r.rows[0];
  } catch (_e) { /* ignore */ }
  if (!row) {
    const r = await db.query(
      "SELECT id, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );
    if (!r.rows.length) throw new Error('No admin user available for MCP service identity');
    row = r.rows[0];
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const ttlSeconds = 15 * 60;
  _cachedToken = jwt.sign({ userId: row.id, role: row.role || 'admin' }, secret, { expiresIn: ttlSeconds });
  _cachedExp = now + ttlSeconds * 1000;
  return _cachedToken;
}

// Proxy a call to the internal REST API and shape it as an MCP tool result.
async function proxy(method, path, query, body) {
  if (!path || typeof path !== 'string') {
    return errorResult("Missing 'path'");
  }
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  // Block path traversal out of /api.
  if (p.includes('..')) return errorResult("Invalid path");

  let token;
  try {
    token = await getServiceToken();
  } catch (e) {
    return errorResult(`Service auth failed: ${e.message}`);
  }

  try {
    const resp = await axios({
      method: String(method || 'GET').toUpperCase(),
      url: internalBaseUrl() + p,
      params: query && typeof query === 'object' ? query : undefined,
      data: body && typeof body === 'object' ? body : undefined,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: () => true,
    });
    const payload = { status: resp.status, data: resp.data };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      isError: resp.status >= 400,
    };
  } catch (e) {
    return errorResult(`Request failed: ${e.message}`);
  }
}

// Introspect the mounted Express routers to describe available endpoints.
function listEndpoints() {
  const map = {
    leads: '../routes/leads',
    customers: '../routes/customers',
    employees: '../routes/employees',
    shifts: '../routes/shifts',
    events: '../routes/events',
    invoices: '../routes/invoices',
    reports: '../routes/reports',
    dashboard: '../routes/dashboard',
    integrations: '../routes/integrations',
    search: '../routes/search',
    users: '../routes/users',
    incidents: '../routes/incidents',
    certifications: '../routes/certifications',
    weapons: '../routes/weapons',
    'shift-templates': '../routes/shiftTemplates',
    patrols: '../routes/patrols',
    sites: '../routes/sites',
    performance: '../routes/performance',
    equipment: '../routes/equipment',
    documents: '../routes/documents',
    automation: '../routes/automation',
    contractors: '../routes/contractors',
  };
  const out = {};
  for (const [resource, modPath] of Object.entries(map)) {
    const prefix = '/' + resource;
    const endpoints = [];
    try {
      const mod = require(modPath);
      const stack = (mod && mod.stack) || [];
      for (const layer of stack) {
        if (!layer.route) continue;
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());
        const sub = layer.route.path === '/' ? '' : layer.route.path;
        endpoints.push({ methods, path: prefix + sub });
      }
    } catch (e) {
      endpoints.push({ error: `could not introspect: ${e.message}` });
    }
    out[resource] = endpoints;
  }
  return out;
}

// ---- tool definitions -----------------------------------------

const TOOLS = [
  {
    name: 'crm_list_endpoints',
    description:
      'List every available CRM API resource with its HTTP methods and paths. ' +
      'Call this first to discover what operations exist before using crm_request.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'crm_request',
    description:
      'Make a request to the CRM REST API (full read & write access). ' +
      "Paths are relative to /api and must start with '/', e.g. '/leads', " +
      "'/customers/<id>', '/events/<id>/assign'. Use 'query' for list filters/" +
      "pagination (e.g. {status,search,page,limit}) and 'body' for create/update " +
      'payloads. Returns the HTTP status and JSON response.',
    inputSchema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method',
        },
        path: {
          type: 'string',
          description: "API path relative to /api, starting with '/'",
        },
        query: {
          type: 'object',
          description: 'Optional query-string parameters',
          additionalProperties: true,
        },
        body: {
          type: 'object',
          description: 'Optional JSON body for POST/PUT/PATCH',
          additionalProperties: true,
        },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'crm_dashboard',
    description: 'Get the CRM dashboard summary (KPIs, counts, recent activity).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'crm_search',
    description: 'Global search across the CRM (leads, customers, employees, events, ...).',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Search query text' } },
      required: ['q'],
    },
  },
];

function textResult(text) {
  return { content: [{ type: 'text', text }], isError: false };
}
function errorResult(message) {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'crm_list_endpoints':
      return textResult(JSON.stringify(listEndpoints(), null, 2));
    case 'crm_dashboard':
      return proxy('GET', '/dashboard');
    case 'crm_search':
      if (!args.q) return errorResult("Missing 'q'");
      return proxy('GET', '/search', { q: args.q });
    case 'crm_request':
      return proxy(args.method, args.path, args.query, args.body);
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC handling ----------------------------------------

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

async function handleRpc(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg && msg.id, -32600, 'Invalid Request');
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'CRM for Tzevet Yahalom. Use crm_list_endpoints to discover resources, ' +
          'then crm_request for any read/write operation. crm_dashboard and crm_search are shortcuts.',
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      if (!params || typeof params.name !== 'string') {
        return rpcError(id, -32602, 'Invalid params: missing tool name');
      }
      const result = await callTool(params.name, params.arguments);
      return rpcResult(id, result);
    }
    default:
      if (isNotification || method.startsWith('notifications/')) {
        return null; // notifications get no response
      }
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---- auth middleware ------------------------------------------

router.use((req, res, next) => {
  const configured = process.env.MCP_API_TOKEN;
  if (!configured) {
    return res.status(503).json(
      rpcError(null, -32000, 'MCP server disabled: MCP_API_TOKEN is not configured')
    );
  }
  if (req.method === 'GET' || req.method === 'POST') {
    const auth = req.headers['authorization'] || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query && req.query.api_key) || '';
    if (!safeEqual(provided, configured)) {
      return res.status(401).json(rpcError(null, -32001, 'Unauthorized'));
    }
  }
  next();
});

// ---- routes ----------------------------------------------------

router.post('/', async (req, res) => {
  const body = req.body;
  try {
    if (Array.isArray(body)) {
      const responses = [];
      for (const msg of body) {
        const r = await handleRpc(msg);
        if (r) responses.push(r);
      }
      if (responses.length === 0) return res.status(202).end();
      return res.json(responses);
    }
    const r = await handleRpc(body);
    if (!r) return res.status(202).end();
    return res.json(r);
  } catch (e) {
    console.error('MCP handler error:', e.message);
    return res.status(500).json(rpcError(body && body.id, -32603, `Internal error: ${e.message}`));
  }
});

// This stateless server does not offer server-initiated SSE streams.
router.get('/', (req, res) => {
  res.status(405).json(rpcError(null, -32000, 'Method Not Allowed (no SSE stream)'));
});
router.delete('/', (req, res) => {
  res.status(405).json(rpcError(null, -32000, 'Method Not Allowed'));
});

module.exports = router;
