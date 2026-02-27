# Polsia - Autonomous AI Platform

## Architecture
Two-process architecture:
1. **Next.js App** (`npm run dev`) — Frontend + API at localhost:3000
2. **Worker Process** (`npm run worker:dev`) — Background agent orchestration

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- PostgreSQL (Neon) + Drizzle ORM
- Clerk auth, Stripe billing
- `@anthropic-ai/sdk` for AI agents
- `@modelcontextprotocol/sdk` for MCP tool servers
- shadcn/ui + Tailwind CSS v4
- node-cron for scheduling

## Key Directories
- `app/` — Next.js App Router pages and API routes
- `actions/` — Server Actions (companies, customers, templates, agents)
- `worker/` — Background worker (scheduler, orchestrator, runtime)
- `mcp-servers/` — 5 MCP tool servers (twitter, email, github-deploy, web-search, analytics)
- `db/schema/` — Drizzle ORM schemas (8 tables)
- `prompts/` — Agent system prompts (ceo.md, engineer.md, growth.md, ops.md)
- `components/` — React components (dashboard, feed, company, landing)
- `lib/` — Shared utilities (anthropic, stripe, sse, mcp-client)

## Database
8 tables: customers, companies, agents, agent_logs, agent_cycles, templates, mcp_servers, metrics

Commands:
- `npm run db:generate` — Generate migrations
- `npm run db:push` — Push schema to database
- `npm run db:seed` — Seed template data
- `npm run db:studio` — Open Drizzle Studio

## Development
```bash
cp .env.example .env.local  # Fill in all keys
npm install
npm run db:push              # Push schema to DB
npm run db:seed              # Seed templates
npm run dev                  # Start Next.js
npm run worker:dev           # Start worker (separate terminal)
```

## Agent System Flow
1. Scheduler (`worker/scheduler.ts`) triggers cycles via node-cron
2. Orchestrator (`worker/orchestrator.ts`) runs the cycle: CEO plans → agents execute
3. Runtime (`worker/runtime.ts`) executes individual agents with agentic loop
4. Tool Builder (`worker/tool-builder.ts`) loads MCP tools for each agent
5. All activity is logged to `agent_logs` and broadcast via SSE

## API Routes
- `POST /api/agent/run` — Run a single agent manually
- `GET /api/agent/feed?companyId=` — SSE feed for company
- `GET /api/agent/feed/public` — Public SSE feed
- `POST /api/companies/[id]/cycle` — Trigger a cycle manually
- `POST /api/webhooks/stripe` — Stripe webhook
- `POST /api/webhooks/clerk` — Clerk webhook

## MCP Servers
Run standalone: `npx tsx mcp-servers/twitter/src/index.ts`
Each server uses `@modelcontextprotocol/sdk` StdioServerTransport.

## Conventions
- Server Actions in `actions/` — used by pages and API routes
- Client components have "use client" directive
- All database queries go through Drizzle ORM
- SSE broadcast via `lib/sse.ts` for real-time updates
