import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "polsia-analytics",
  version: "1.0.0",
});

// In-memory store for the MCP server process (in production, writes to DB via API)
const metricsStore: Array<{
  name: string;
  value: number;
  unit?: string;
  recordedAt: string;
}> = [];

server.tool(
  "record_metric",
  "Record a business metric data point",
  {
    name: z.string().describe("Metric name (e.g. 'revenue', 'active_users', 'tweets_sent')"),
    value: z.number().describe("Metric value"),
    unit: z.string().optional().describe("Unit (e.g. 'USD', 'count', 'percent')"),
  },
  async ({ name, value, unit }) => {
    const entry = {
      name,
      value,
      unit,
      recordedAt: new Date().toISOString(),
    };
    metricsStore.push(entry);
    console.log(`[Analytics] Recorded: ${name} = ${value} ${unit ?? ""}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, metric: entry }),
        },
      ],
    };
  }
);

server.tool(
  "get_summary",
  "Get a summary of all tracked metrics",
  {
    period: z.string().optional().describe("Time period (e.g. 'today', 'week', 'month')"),
  },
  async ({ period }) => {
    // Group metrics by name and compute stats
    const grouped: Record<string, number[]> = {};
    for (const m of metricsStore) {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m.value);
    }

    const summary = Object.entries(grouped).map(([name, values]) => ({
      name,
      latest: values[values.length - 1],
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ summary, period: period ?? "all", totalDataPoints: metricsStore.length }),
        },
      ],
    };
  }
);

server.tool(
  "get_trend",
  "Get trend data for a specific metric",
  {
    name: z.string().describe("Metric name to get trend for"),
    points: z.number().optional().describe("Number of data points (default 10)"),
  },
  async ({ name, points = 10 }) => {
    const relevant = metricsStore
      .filter((m) => m.name === name)
      .slice(-points);

    const trend =
      relevant.length >= 2
        ? relevant[relevant.length - 1].value > relevant[0].value
          ? "up"
          : relevant[relevant.length - 1].value < relevant[0].value
            ? "down"
            : "flat"
        : "insufficient_data";

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            name,
            trend,
            dataPoints: relevant,
            count: relevant.length,
          }),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Analytics MCP] Server started");
}

main().catch(console.error);
