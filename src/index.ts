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

  // Try cache first
  let response = await cache.match(cacheKey);

  if (!response) {
    // Cache miss - fetch from origin
    response = await fetch(url);
    if (response.ok) {
      // Clone and cache for future requests
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
// Factory: Create MCP Server (stateless)
// ============================================
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "hono-mcp-server",
    version: "1.0.0",
  });

  // ============================================
  // Register Tools
  // ============================================

  // Tool: Add two numbers
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
        content: [
          {
            type: "text",
            text: `${a} + ${b} = ${result}`,
          },
        ],
      };
    }
  );

  // Tool: Multiply two numbers
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
        content: [
          {
            type: "text",
            text: `${a} × ${b} = ${result}`,
          },
        ],
      };
    }
  );

  // Tool: Get current UTC time
  server.tool(
    "get-time",
    "Get the current UTC time",
    {},
    async () => {
      const now = new Date().toISOString();
      return {
        content: [
          {
            type: "text",
            text: `Current UTC time: ${now}`,
          },
        ],
      };
    }
  );

  // ============================================
  // Hono Documentation Tools (with caching)
  // ============================================

  // Tool: Search Hono docs (uses smaller llms.txt by default)
  server.tool(
    "search-hono-docs",
    "Search Hono documentation for a query and return matching pages",
    {
      query: z.string().describe("Search query for Hono docs"),
      limit: z.number().optional().describe("Number of results to return (default 5)"),
    },
    async ({ query, limit = 5 }) => {
      // Use smaller llms.txt for faster response
      const text = await fetchHonoDocs("https://hono.dev/llms.txt");
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
          content: [
            {
              type: "text",
              text: `No documentation results found for "${query}".`,
            },
          ],
        };
      }

      const linesOut = results.map((r, idx) => `${idx + 1}. ${r.title} — ${r.url}`).join("\n");
      return {
        content: [
          {
            type: "text",
            text: linesOut,
          },
        ],
      };
    }
  );

  // Tool: Get Hono documentation page content (cached)
  server.tool(
    "get-hono-page",
    "Fetch the Markdown content of a Hono documentation page",
    {
      path: z.string().describe("Hono docs path starting with '/docs', e.g. '/docs/api/context'"),
    },
    async ({ path }) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const githubUrl = `https://raw.githubusercontent.com/honojs/website/main${normalizedPath}.md`;

      try {
        const md = await fetchHonoDocs(githubUrl);
        return {
          content: [
            {
              type: "text",
              text: md,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Could not retrieve documentation for ${normalizedPath}. Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Tool: List sections of a Hono documentation page (cached)
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
            content: [
              {
                type: "text",
                text: `No sections found in ${normalizedPath}.`,
              },
            ],
          };
        }

        const outputLines = sections
          .map((sec) => {
            const indent = "  ".repeat(sec.level - 2);
            return `${indent}- ${sec.title} (${sec.anchor})`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: outputLines,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Could not retrieve documentation for ${normalizedPath}. Error: ${error}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  // Register Prompts
  // ============================================

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
// Routes
// ============================================

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    name: "hono-mcp-server",
    version: "1.0.0",
    mcp_endpoint: "/mcp",
    status: "healthy",
  });
});

// MCP endpoint - TRUE STATELESS (new server per request)
app.all("/mcp", async (c) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default app;
