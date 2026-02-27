import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "polsia-twitter",
  version: "1.0.0",
});

// In production, these would call the Twitter/X API
// For now, they simulate the actions and return realistic responses

server.tool(
  "post_tweet",
  "Post a tweet to Twitter/X",
  { content: z.string().describe("The tweet content (max 280 characters)") },
  async ({ content }) => {
    const tweetId = `tweet_${Date.now()}`;
    console.log(`[Twitter] Posting tweet: ${content.slice(0, 50)}...`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            tweetId,
            content: content.slice(0, 280),
            url: `https://x.com/company/${tweetId}`,
            postedAt: new Date().toISOString(),
          }),
        },
      ],
    };
  }
);

server.tool(
  "get_tweet_metrics",
  "Get engagement metrics for recent tweets",
  { count: z.number().optional().describe("Number of recent tweets to analyze (default 10)") },
  async ({ count = 10 }) => {
    const metrics = {
      totalTweets: count,
      totalImpressions: Math.floor(Math.random() * 50000) + 10000,
      totalLikes: Math.floor(Math.random() * 500) + 50,
      totalRetweets: Math.floor(Math.random() * 100) + 10,
      totalReplies: Math.floor(Math.random() * 50) + 5,
      engagementRate: (Math.random() * 5 + 1).toFixed(2) + "%",
      period: "last 7 days",
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(metrics) }],
    };
  }
);

server.tool(
  "get_mentions",
  "Get recent mentions and replies",
  { since: z.string().optional().describe("ISO date to search from") },
  async ({ since }) => {
    const mentions = [
      {
        id: "m1",
        author: "@user1",
        text: "Love this product!",
        createdAt: new Date().toISOString(),
      },
      {
        id: "m2",
        author: "@user2",
        text: "How do I get started?",
        createdAt: new Date().toISOString(),
      },
    ];
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ mentions, count: mentions.length }) }],
    };
  }
);

server.tool(
  "search_tweets",
  "Search Twitter for relevant tweets",
  { query: z.string().describe("Search query"), count: z.number().optional() },
  async ({ query, count = 10 }) => {
    const results = [
      {
        id: "s1",
        author: "@techuser",
        text: `Great insights about ${query}`,
        likes: 42,
      },
      {
        id: "s2",
        author: "@founder",
        text: `Building something cool with ${query}`,
        likes: 128,
      },
    ];
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ results, query }) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Twitter MCP] Server started");
}

main().catch(console.error);
