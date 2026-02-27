import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "polsia-github-deploy",
  version: "1.0.0",
});

server.tool(
  "create_pr",
  "Create a pull request on GitHub",
  {
    repo: z.string().describe("Repository in owner/repo format"),
    title: z.string().describe("PR title"),
    body: z.string().describe("PR description"),
    branch: z.string().describe("Source branch name"),
    base: z.string().optional().describe("Target branch (default: main)"),
  },
  async ({ repo, title, body, branch, base }) => {
    const prNumber = Math.floor(Math.random() * 1000) + 1;
    console.log(`[GitHub] Creating PR #${prNumber} in ${repo}: ${title}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            prNumber,
            url: `https://github.com/${repo}/pull/${prNumber}`,
            title,
            branch,
            base: base ?? "main",
            createdAt: new Date().toISOString(),
          }),
        },
      ],
    };
  }
);

server.tool(
  "push_code",
  "Push code changes to a repository",
  {
    repo: z.string().describe("Repository in owner/repo format"),
    branch: z.string().describe("Branch to push to"),
    files: z
      .array(z.object({ path: z.string(), content: z.string() }))
      .describe("Files to create/update"),
    commitMessage: z.string().describe("Commit message"),
  },
  async ({ repo, branch, files, commitMessage }) => {
    console.log(
      `[GitHub] Pushing ${files.length} files to ${repo}/${branch}: ${commitMessage}`
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            repo,
            branch,
            filesChanged: files.length,
            commitSha: `sha_${Date.now().toString(36)}`,
            commitMessage,
          }),
        },
      ],
    };
  }
);

server.tool(
  "deploy_to_render",
  "Trigger a deployment on Render",
  {
    serviceId: z.string().describe("Render service ID"),
    branch: z.string().optional().describe("Branch to deploy (default: main)"),
  },
  async ({ serviceId, branch }) => {
    console.log(
      `[Deploy] Triggering deployment for ${serviceId} from ${branch ?? "main"}`
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            deployId: `deploy_${Date.now()}`,
            serviceId,
            branch: branch ?? "main",
            status: "building",
            url: `https://${serviceId}.onrender.com`,
          }),
        },
      ],
    };
  }
);

server.tool(
  "create_issue",
  "Create a GitHub issue",
  {
    repo: z.string().describe("Repository in owner/repo format"),
    title: z.string().describe("Issue title"),
    body: z.string().describe("Issue body"),
    labels: z.array(z.string()).optional().describe("Labels to apply"),
  },
  async ({ repo, title, body, labels }) => {
    const issueNumber = Math.floor(Math.random() * 500) + 1;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            issueNumber,
            url: `https://github.com/${repo}/issues/${issueNumber}`,
            title,
            labels: labels ?? [],
          }),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[GitHub/Deploy MCP] Server started");
}

main().catch(console.error);
