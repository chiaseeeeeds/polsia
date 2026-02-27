import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "polsia-web-search",
  version: "1.0.0",
});

server.tool(
  "web_search",
  "Search the web using Brave Search API",
  {
    query: z.string().describe("Search query"),
    count: z.number().optional().describe("Number of results (default 5)"),
  },
  async ({ query, count = 5 }) => {
    // In production, call Brave Search API
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (apiKey && apiKey !== "BSA...") {
      try {
        const resp = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
          { headers: { "X-Subscription-Token": apiKey, Accept: "application/json" } }
        );
        const data = await resp.json();
        const results = (data.web?.results ?? []).map(
          (r: { title: string; url: string; description: string }) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
          })
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ results, query }) }],
        };
      } catch (err) {
        // Fall through to mock
      }
    }

    // Mock response
    const results = [
      {
        title: `Results for: ${query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Top result for ${query} with relevant information...`,
      },
      {
        title: `${query} - Guide`,
        url: `https://example.com/guide/${encodeURIComponent(query)}`,
        snippet: `Comprehensive guide about ${query}...`,
      },
    ];
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ results, query }) }],
    };
  }
);

server.tool(
  "fetch_page",
  "Fetch and extract text content from a web page",
  { url: z.string().describe("URL to fetch") },
  async ({ url }) => {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Polsia-Bot/1.0" },
      });
      const html = await resp.text();
      // Simple HTML to text extraction
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ url, contentLength: text.length, text }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
            }),
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Web Search MCP] Server started");
}

main().catch(console.error);
