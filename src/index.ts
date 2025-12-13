import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";

const app = new Hono();

// Create MCP Server
const mcpServer = new McpServer({
  name: "hono-mcp-server",
  version: "1.0.0",
});

// ============================================
// Register Tools
// ============================================

// Tool: Add two numbers
mcpServer.tool(
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
mcpServer.tool(
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
mcpServer.tool(
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
// Register Prompts
// ============================================

mcpServer.prompt(
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

// MCP endpoint - handles all MCP protocol requests
app.all("/mcp", async (c) => {
  const transport = new StreamableHTTPTransport();
  await mcpServer.connect(transport);
  return transport.handleRequest(c);
});

export default app;
