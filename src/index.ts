import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";

const app = new Hono();

// ============================================
// Helper: Cached fetch for Hono docs
// ============================================
async function fetchHonoDocs(url: string, cacheTtl = 3600): Promise<string> {
  const cache = caches.default;
  const cacheKey = new Request(url);

  let response = await cache.match(cacheKey);

  if (!response) {
    response = await fetch(url);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("Cache-Control", `public, max-age=${cacheTtl}`);
      const cachedResponse = new Response(cloned.body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      await cache.put(cacheKey, cachedResponse);
    }
  }

  return response.text();
}

// ============================================
// Create MCP Server (called once globally)
// ============================================
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "hono-mcp-server",
    version: "1.0.0",
  });

  // Tool: Add
  server.tool(
    "add",
    "Add two numbers together",
    {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
    async ({ a, b }) => {
      const result = a + b;
      return {
        content: [{ type: "text", text: `${a} + ${b} = ${result}` }],
      };
    }
  );

  // Tool: Multiply
  server.tool(
    "multiply",
    "Multiply two numbers together",
    {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
    async ({ a, b }) => {
      const result = a * b;
      return {
        content: [{ type: "text", text: `${a} × ${b} = ${result}` }],
      };
    }
  );

  // Tool: Get time
  server.tool(
    "get-time",
    "Get the current UTC time",
    {},
    async () => {
      const now = new Date().toISOString();
      return {
        content: [{ type: "text", text: `Current UTC time: ${now}` }],
      };
    }
  );

  // Tool: Search Hono docs
  server.tool(
    "search-hono-docs",
    "Search Hono documentation for a query and return matching pages",
    {
      query: z.string().describe("Search query for Hono docs"),
      limit: z.number().optional().describe("Number of results to return (default 5)"),
    },
    async ({ query, limit = 5 }) => {
      const text = await fetchHonoDocs("https://hono.dev/llms-full.txt");
      const lines = text.split("\n");
      const lowerQuery = query.toLowerCase();
      const results: { title: string; path: string; url: string }[] = [];

      for (const line of lines) {
        if (results.length >= limit) break;
        if (line.toLowerCase().includes(lowerQuery)) {
          const match = line.match(/\((\/docs[^)]+)\)/);
          if (match) {
            const path = match[1];
            const url = `https://hono.dev${path}`;
            results.push({ title: line.trim(), path, url });
          }
        }
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No documentation results found for "${query}".` }],
        };
      }

      const linesOut = results.map((r, idx) => `${idx + 1}. ${r.title} — ${r.url}`).join("\n");
      return {
        content: [{ type: "text", text: linesOut }],
      };
    }
  );

  // Tool: Get Hono page (paginated)
  server.tool(
    "get-hono-page",
    "Fetch the Markdown content of a Hono documentation page (paginated for large docs)",
    {
      path: z.string().describe("Hono docs path starting with '/docs', e.g. '/docs/api/context'"),
      offset: z.number().int().min(0).optional().describe("Character offset for pagination (default 0)"),
      maxChars: z.number().int().min(1000).max(120000).optional().describe("Max characters to return (default 40000)"),
    },
    async ({ path, offset = 0, maxChars = 40000 }) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const githubUrl = `https://raw.githubusercontent.com/honojs/website/main${normalizedPath}.md`;

      try {
        const md = await fetchHonoDocs(githubUrl);
        const totalChars = md.length;
        const slice = md.slice(offset, offset + maxChars);
        const nextOffset = offset + maxChars < totalChars ? offset + maxChars : null;

        let text = slice;
        if (nextOffset !== null) {
          text += `\n\n--- Page truncated at ${offset + maxChars}/${totalChars} chars. Use offset=${nextOffset} to continue. ---`;
        }

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Could not retrieve documentation for ${normalizedPath}. Error: ${error}` }],
        };
      }
    }
  );

  // Tool: List sections
  server.tool(
    "list-sections",
    "List the headings in a Hono documentation page",
    {
      path: z.string().describe("Hono docs path starting with '/docs', e.g. '/docs/api/context'"),
    },
    async ({ path }) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const githubUrl = `https://raw.githubusercontent.com/honojs/website/main${normalizedPath}.md`;

      try {
        const md = await fetchHonoDocs(githubUrl);
        const lines = md.split("\n");
        const sections: { level: number; title: string; anchor: string }[] = [];

        for (const line of lines) {
          const match = line.match(/^(#{2,6})\s+(.+)/);
          if (match) {
            const hashes = match[1];
            const title = match[2].trim();
            const level = hashes.length;
            const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
            sections.push({ level, title, anchor: `#${slug}` });
          }
        }

        if (sections.length === 0) {
          return {
            content: [{ type: "text", text: `No sections found in ${normalizedPath}.` }],
          };
        }

        const outputLines = sections
          .map((sec) => {
            const indent = "  ".repeat(sec.level - 2);
            return `${indent}- ${sec.title} (${sec.anchor})`;
          })
          .join("\n");

        return {
          content: [{ type: "text", text: outputLines }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Could not retrieve documentation for ${normalizedPath}. Error: ${error}` }],
        };
      }
    }
  );

  // Prompt: Greeting
  server.prompt(
    "greeting-template",
    "A simple greeting prompt template",
    {
      name: z.string().describe("Name to greet"),
    },
    async ({ name }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please greet ${name} in a friendly and professional manner.`,
            },
          },
        ],
      };
    }
  );

  return server;
}

// ============================================
// Global singleton (Antigravity-friendly)
// ============================================
const mcpServer = createMcpServer();
const transport = new StreamableHTTPTransport();
let isConnected = false;

// ============================================
// Routes
// ============================================

app.get("/", (c) => {
  return c.json({
    name: "hono-mcp-server",
    version: "1.0.0",
    mcp_endpoint: "/mcp",
    status: "healthy",
    mode: "singleton-transport",
  });
});

// MCP endpoint - Singleton transport (connect once)
app.get("/mcp", (c) => {
  // Explicitly reject standalone SSE (GET) - we only support POST with direct responses
  return c.text("Method Not Allowed: This server only supports POST for MCP requests", 405);
});

app.post("/mcp", async (c) => {
  if (!isConnected) {
    await mcpServer.connect(transport);
    isConnected = true;
  }
  return transport.handleRequest(c);
});

export default app;
