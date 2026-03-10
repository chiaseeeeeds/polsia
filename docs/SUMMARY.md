# Runloop Documentation Summary

Complete reference for building the Runloop platform. This is the master index.

---

## Core Systems

### 1. [Agent System](./AGENT_PROMPTS.md)
- 8 production agents with exact system prompts
- Agent behavioral rules and standards
- Template variables and dynamic context

### 2. [MCP Servers](./MCP_SERVERS.md)
- 22 MCP servers with complete tool specifications
- Tool calling conventions and error handling
- MCP mounting strategy per agent

### 3. [CEO Module](./CEO_MODULE.md)
- Conversational orchestration layer (the product interface)
- 50+ tools across all MCP servers
- Behavioral rules, voice & tone, routing logic

### 4. [Task System](./TASK_SYSTEM.md)
- Complete task lifecycle (suggested → completed)
- Worker polling, execution, timeouts, retries
- Agent cross-task creation for collaboration
- Queue management and prioritization

### 5. [Memory System](./MEMORY_SYSTEM.md)
- 3-layer architecture (domain, preferences, cross-company)
- Semantic search with embeddings
- Auto-curation and conversation auto-save
- 33K tokens total context per agent

### 6. [Cycle Engine](./CYCLE_ENGINE.md)
- Nightly autonomous planning and execution
- Planning → Execution → Review phases
- Morning summaries and metrics tracking
- User control over frequency and focus

---

## Infrastructure

### 7. [Database Schema](./DATABASE_SCHEMA.md)
- Complete PostgreSQL schema for all tables
- Proper indexes, foreign keys, constraints
- Migration strategy and idempotent DDL

### 8. [API Endpoints](./API_ENDPOINTS.md)
- Full REST API specification
- Auth, chat, tasks, agents, memory, reports
- Request/response formats and error handling

### 9. [UI Design](./UI_DESIGN.md)
- Premium dark-mode design system
- Color palette, typography, spacing
- Component library and micro-animations
- Linear × Vercel × Arc aesthetic

---

## User Experience

### 10. [Onboarding Flow](./ONBOARDING_FLOW.md)
- 16-step sequence from signup to first chat
- Document generation, agent seeding, infrastructure setup
- Completion tracking and drop-off prevention

### 11. [Subscription & Billing](./SUBSCRIPTION_BILLING.md)
- Simple pricing: $29/mo base + add-ons
- Stripe integration with webhooks
- Instant tasks credit system
- Free trial and referral program

---

## Agent Features

### 12. [send_reply System](./SEND_REPLY.md)
- Real-time agent-to-user communication
- SSE for live message delivery
- Makes platform feel alive during execution

### 13. [Learnings System](./LEARNINGS_SYSTEM.md)
- Agent-generated knowledge capture
- 5 MCP tools for create/query/search
- Confidence scores and curation

### 14. [Agent Factory](./AGENT_FACTORY.md)
- Custom agent creation beyond 8 platform agents
- Templates for designer, QA, content, sales
- Tool selection and system prompt configuration

### 15. [Skills System](./SKILLS_SYSTEM.md)
- Reusable step-by-step procedures
- Platform skills + local company skills
- Agents save skills after successful execution

---

## Additional Systems

### 16. Workflows (TBD)
- Multi-agent task chaining
- Trigger types: manual, schedule, webhook
- Workflow runs tracking

### 17. Recurring Tasks (TBD)
- Daily, weekdays, weekly, monthly frequencies
- Template-based task creation
- Auto-scheduling

### 18. Email System (TBD)
- Auto-provisioned {slug}@polsia.app addresses
- Rate limits: 2/day cold, unlimited replies
- CRM contact management

### 19. Browser Auth (TBD)
- 4-tier site system
- Credential storage and persistent contexts
- Verification email checking

### 20. Scoring & Routing (TBD)
- 1-10 task scoring after completion
- find_best_agent cross-company intelligence
- Historical performance analysis

---

## Build Order

**Phase 0:** Documentation (COMPLETE ✓)
**Phase 1:** Database schema
**Phase 2:** Auth system
**Phase 3:** CEO Chat interface
**Phase 4:** Seed 8 agents
**Phase 5:** Task queue worker
**Phase 6:** Memory system
**Phase 7:** Documents
**Phase 8:** Tool registry
**Phase 9:** Onboarding wizard
**Phase 10:** Cycle engine
**Phase 11:** Recurring tasks
**Phase 12:** Dashboard & analytics
**Phase 13:** Agent Factory
**Phase 14:** Skills & Learnings
**Phase 15:** Email, Workflows, Settings
**Phase 16:** Premium UI polish

---

## Technology Stack

**Backend:**
- Express.js (Node.js)
- PostgreSQL (Neon)
- OpenAI API (gpt-4-turbo)

**Frontend:**
- Vanilla JS + Tailwind CSS
- Server-Sent Events for real-time
- No framework (keep it simple)

**Infrastructure:**
- Render (hosting)
- GitHub (version control)
- Stripe (payments)

**Extensions:**
- pgvector for embeddings
- node-cron for scheduling
- bcrypt for auth
- express-session for sessions

---

## Key Principles

1. **Documentation First** - These docs ARE the spec
2. **No Placeholders** - Everything works end-to-end
3. **Real Data** - No fake/mock data
4. **Premium Quality** - $10M venture backing aesthetic
5. **Autonomous** - Agents work without human input
6. **Transparent** - Users see what's happening in real-time

---

## Definition of Done

✅ All documentation files complete
✅ Signup → onboarding → /chat with welcome
✅ Chat: REAL LLM with company context + tool calling
✅ All 8 agents with EXACT production prompts
✅ Task queue: create → execute → results
✅ Agent collaboration: cross-task creation
✅ send_reply: real-time updates during execution
✅ Memory: 3 layers, search, persist
✅ Documents: 5 types, CRUD, agent-referenced
✅ Recurring tasks on schedule
✅ Cycle engine nightly execution
✅ Agent Factory: create custom agents
✅ Skills + Learnings systems functional
✅ Email, workflows, settings pages
✅ Dashboard with REAL data
✅ Premium dark-mode design throughout
✅ Mobile responsive, no crashes, no 500s

---

## Reference Links

- **Production App:** https://runloop.polsia.app
- **GitHub Repo:** https://github.com/Polsia-Inc/runloop
- **Instance ID:** 4295

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| AGENT_PROMPTS.md | ✅ Complete | 2026-03-04 |
| MCP_SERVERS.md | ✅ Complete | 2026-03-04 |
| CEO_MODULE.md | ✅ Complete | 2026-03-04 |
| MEMORY_SYSTEM.md | ✅ Complete | 2026-03-04 |
| TASK_SYSTEM.md | ✅ Complete | 2026-03-04 |
| CYCLE_ENGINE.md | ✅ Complete | 2026-03-04 |
| DATABASE_SCHEMA.md | ✅ Complete | 2026-03-04 |
| API_ENDPOINTS.md | ✅ Complete | 2026-03-04 |
| UI_DESIGN.md | ✅ Complete | 2026-03-04 |
| ONBOARDING_FLOW.md | ✅ Complete | 2026-03-04 |
| SEND_REPLY.md | ✅ Complete | 2026-03-04 |
| LEARNINGS_SYSTEM.md | ✅ Complete | 2026-03-04 |
| AGENT_FACTORY.md | ✅ Complete | 2026-03-04 |
| SKILLS_SYSTEM.md | ✅ Complete | 2026-03-04 |
| SUBSCRIPTION_BILLING.md | ✅ Complete | 2026-03-04 |

**Total:** 15 complete documentation files
**Coverage:** ~95% of platform specification

---

## Next Steps

1. ✅ **Phase 0 Complete** - All documentation written
2. **Phase 1** - Implement database schema from DATABASE_SCHEMA.md
3. **Phase 2** - Build auth system from API_ENDPOINTS.md
4. **Phase 3** - Build CEO chat interface (the product)
5. Continue through remaining phases...

---

## Questions?

This documentation is the source of truth. If something isn't documented here, it doesn't exist yet.

**Start building from these specs. No improvisation. Follow the docs.**
