import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "polsia-email",
  version: "1.0.0",
});

// In production, these would use the Resend API
server.tool(
  "send_email",
  "Send an email via Resend",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML supported)"),
    from: z.string().optional().describe("Sender name (default: company name)"),
  },
  async ({ to, subject, body, from }) => {
    const emailId = `email_${Date.now()}`;
    console.log(`[Email] Sending to ${to}: ${subject}`);

    // In production: Resend.emails.send(...)
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            emailId,
            to,
            subject,
            sentAt: new Date().toISOString(),
          }),
        },
      ],
    };
  }
);

server.tool(
  "get_inbox",
  "Get recent emails from inbox",
  { limit: z.number().optional().describe("Number of emails to retrieve") },
  async ({ limit = 20 }) => {
    const emails = [
      {
        id: "in1",
        from: "user@example.com",
        subject: "Partnership inquiry",
        preview: "Hi, I'd love to explore a partnership...",
        receivedAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "in2",
        from: "support@example.com",
        subject: "Feature request",
        preview: "Could you add integration with...",
        receivedAt: new Date().toISOString(),
        read: true,
      },
    ];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ emails, total: emails.length }),
        },
      ],
    };
  }
);

server.tool(
  "reply_email",
  "Reply to an email",
  {
    emailId: z.string().describe("ID of the email to reply to"),
    body: z.string().describe("Reply body"),
  },
  async ({ emailId, body }) => {
    console.log(`[Email] Replying to ${emailId}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            replyId: `reply_${Date.now()}`,
            inReplyTo: emailId,
            sentAt: new Date().toISOString(),
          }),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Email MCP] Server started");
}

main().catch(console.error);
