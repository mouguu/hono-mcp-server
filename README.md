# Hono MCP Server

A production-ready [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server built with [Hono](https://hono.dev/), deployable to Cloudflare Workers.

## Features

- 🚀 **Serverless** - Runs on Cloudflare Workers edge network
- ⚡ **Fast** - Built on Hono, the ultrafast web framework
- 🔧 **Extensible** - Easy to add custom tools and prompts
- 🌐 **Universal** - Works with any MCP-compatible client

## Included Tools

| Tool       | Description                   |
| ---------- | ----------------------------- |
| `add`      | Add two numbers together      |
| `multiply` | Multiply two numbers together |
| `get-time` | Get the current UTC time      |

## Included Prompts

| Prompt              | Description                       |
| ------------------- | --------------------------------- |
| `greeting-template` | A simple greeting prompt template |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Cloudflare account (for deployment)

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

The server will start at `http://localhost:8787`

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

1. Select **Streamable HTTP** transport
2. Enter URL: `http://localhost:8787/mcp`
3. Try commands:
   - `list-tools`
   - `list-prompts`
   - `call-tool add {"a": 5, "b": 3}`

### Deploy to Cloudflare

```bash
npm run deploy
```

Your server will be available at `https://hono-mcp-server.<your-subdomain>.workers.dev/mcp`

## Client Configuration

### Cursor

```json
{
  "mcpServers": {
    "hono-mcp": {
      "url": "https://hono-mcp-server.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "hono-mcp": {
      "serverUrl": "https://hono-mcp-server.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "hono-mcp": {
      "transport": "streamable-http",
      "url": "https://hono-mcp-server.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

## Adding Custom Tools

Edit `src/index.ts` and add new tools:

```typescript
mcpServer.tool(
  "my-tool", // Tool name
  "Tool description", // Description
  {
    param1: z.string().describe("Parameter description"),
  },
  async ({ param1 }) => {
    // Your tool logic here
    return {
      content: [
        {
          type: "text",
          text: `Result: ${param1}`,
        },
      ],
    };
  }
);
```

## Project Structure

```
├── src/
│   └── index.ts        # Main MCP server
├── package.json        # Dependencies
├── wrangler.toml       # Cloudflare config
├── tsconfig.json       # TypeScript config
└── README.md           # This file
```

## License

MIT
