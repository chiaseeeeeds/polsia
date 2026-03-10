# Database Schema

Complete PostgreSQL schema for Runloop. Every table, every field, every index.

---

## Design Principles

1. **Use BIGINT for all IDs** - `GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
2. **Use TEXT, not VARCHAR** - No artificial length limits
3. **Use TIMESTAMPTZ, not TIMESTAMP** - Always store timezone
4. **Use JSONB for flexible data** - Queryable JSON
5. **NOT NULL where appropriate** - Prevent null bugs
6. **CHECK constraints for enums** - Database-level validation
7. **Proper indexes** - Optimize common queries
8. **Foreign keys with ON DELETE** - Data integrity

---

## Core Tables

### users

```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
```

### companies

```sql
CREATE TABLE companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  website TEXT,
  industry TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, deleted
  portfolio_type TEXT, -- owned, polsia_fund

  -- Metrics
  cycles_completed INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,

  -- Settings
  timezone TEXT DEFAULT 'America/Los_Angeles',
  cycle_frequency TEXT DEFAULT 'daily', -- daily, weekdays, weekly
  cycle_time TEXT DEFAULT '23:30', -- HH:MM
  cycles_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_owner ON companies(owner_id);
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_status ON companies(status);
```

---

## Agent Tables

### agents

```sql
CREATE TABLE agents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, -- NULL = platform agent

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL, -- execution, meta_ads, custom

  -- Configuration
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4', -- gpt-4, gpt-4-turbo, claude-sonnet
  max_turns INT DEFAULT 100,
  temperature FLOAT DEFAULT 0.7,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_platform_agent BOOLEAN DEFAULT false, -- true for 8 core agents

  -- Metrics
  tasks_completed INT DEFAULT 0,
  tasks_failed INT DEFAULT 0,
  avg_score FLOAT,
  last_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, slug)
);

CREATE INDEX idx_agents_company ON agents(company_id);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_platform ON agents(is_platform_agent);
```

### agent_tools

```sql
CREATE TABLE agent_tools (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mcp_server TEXT NOT NULL, -- tasks, reports, polsia_infra, etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tools_agent ON agent_tools(agent_id);
CREATE UNIQUE INDEX idx_agent_tools_unique ON agent_tools(agent_id, mcp_server);
```

---

## Chat & Conversation Tables

### conversations

```sql
CREATE TABLE conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title TEXT,
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  -- Auto-save to memory every 20 messages
  last_memory_save_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
```

### messages

```sql
CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,

  -- Agent attribution
  agent_id BIGINT REFERENCES agents(id),
  agent_name TEXT,

  -- Tool calls (for assistant messages)
  tool_calls JSONB, -- [{tool: "...", params: {...}, result: {...}}]

  -- Metadata
  metadata JSONB DEFAULT '{}',
  token_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

---

## Task Tables

### tasks

```sql
CREATE TABLE tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion_reasoning TEXT NOT NULL,

  -- Classification
  tag TEXT NOT NULL CHECK (tag IN ('engineering', 'research', 'browser', 'growth', 'content', 'data', 'support', 'meta_ads')),
  task_type TEXT NOT NULL, -- bug, feature, refactor, css, etc.
  task_category TEXT NOT NULL CHECK (task_category IN ('engineering', 'research', 'growth', 'content', 'support', 'data', 'ops')),

  -- Routing
  suggested_agent_id BIGINT REFERENCES agents(id),
  assigned_agent_id BIGINT REFERENCES agents(id),

  -- Prioritization
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  complexity INT NOT NULL CHECK (complexity BETWEEN 1 AND 10),
  estimated_hours FLOAT NOT NULL CHECK (estimated_hours <= 4),
  queue_position INT,

  -- Execution
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'todo', 'in_progress', 'blocked', 'waiting', 'completed', 'failed', 'rejected')),
  executability_type TEXT NOT NULL CHECK (executability_type IN ('can_run_now', 'needs_new_connection', 'manual_task')),
  execution_id BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  completion_summary TEXT,
  failure_reason TEXT,

  -- Context
  source TEXT CHECK (source IN ('owner_request', 'agent_generated', 'monitoring', 'bug', 'cycle')),
  related_task_ids BIGINT[],
  metadata JSONB DEFAULT '{}',

  -- Scoring
  score INT CHECK (score BETWEEN 1 AND 10),
  score_comment TEXT,
  scored_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_company_status ON tasks(company_id, status);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_queue ON tasks(company_id, status, queue_position) WHERE status = 'todo';
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created ON tasks(created_at);
```

### executions

```sql
CREATE TABLE executions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id BIGINT NOT NULL REFERENCES agents(id),
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),

  -- Logs
  thinking TEXT,
  logs JSONB DEFAULT '[]', -- [{timestamp, type, message, data}]
  tool_calls JSONB DEFAULT '[]',

  -- Metrics
  duration_seconds INT,
  tokens_used INT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_executions_task ON executions(task_id);
CREATE INDEX idx_executions_agent ON executions(agent_id);
CREATE INDEX idx_executions_company ON executions(company_id);
```

---

## Memory Tables

### memory_layer1

```sql
CREATE TABLE memory_layer1 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI ada-002

  accessed_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer1_company ON memory_layer1(company_id);
CREATE INDEX idx_layer1_embedding ON memory_layer1 USING ivfflat (embedding vector_cosine_ops);
```

### memory_layer2

```sql
CREATE TABLE memory_layer2 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer2_company ON memory_layer2(company_id);
```

### memory_layer3

```sql
CREATE TABLE memory_layer3 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('technical', 'ux', 'marketing', 'infrastructure', 'process')),
  confidence FLOAT DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  supporting_evidence_count INT DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer3_category ON memory_layer3(category);
CREATE INDEX idx_layer3_confidence ON memory_layer3(confidence);
CREATE INDEX idx_layer3_embedding ON memory_layer3 USING ivfflat (embedding vector_cosine_ops);
```

---

## Document Tables

### documents

```sql
CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('mission', 'product_overview', 'tech_notes', 'brand_voice', 'user_research')),
  content TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, type)
);

CREATE INDEX idx_documents_company ON documents(company_id);
```

---

## Workflow & Automation Tables

### recurring_tasks

```sql
CREATE TABLE recurring_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  template JSONB NOT NULL, -- Task creation template
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekly', 'monthly')),

  enabled BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_company ON recurring_tasks(company_id);
CREATE INDEX idx_recurring_next_run ON recurring_tasks(next_run_at) WHERE enabled = true;
```

### workflows

```sql
CREATE TABLE workflows (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'webhook', 'task_complete')),

  -- Workflow definition
  steps JSONB NOT NULL, -- [{agent_id, task_template, wait_for_completion}]

  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_company ON workflows(company_id);
```

### workflow_runs

```sql
CREATE TABLE workflow_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  current_step INT DEFAULT 0,

  -- Results
  tasks_created BIGINT[],
  logs JSONB DEFAULT '[]',

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_company ON workflow_runs(company_id);
```

---

## Skills & Learning Tables

### skills

```sql
CREATE TABLE skills (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  skill_name TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown
  keywords TEXT[] NOT NULL,

  -- Access control
  agent_types TEXT[], -- NULL = all agents can use

  -- Usage
  usage_count INT DEFAULT 0,
  created_by_model TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skills_keywords ON skills USING GIN(keywords);
CREATE INDEX idx_skills_name ON skills(skill_name);
```

### learnings

```sql
CREATE TABLE learnings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, -- NULL = platform-wide

  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'process', 'business', 'user_behavior', 'infrastructure', 'debugging')),

  tags TEXT[],
  confidence FLOAT DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),

  created_by_agent_id BIGINT REFERENCES agents(id),
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learnings_company ON learnings(company_id);
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_tags ON learnings USING GIN(tags);
CREATE INDEX idx_learnings_embedding ON learnings USING ivfflat (embedding vector_cosine_ops);
```

---

## Reporting Tables

### reports

```sql
CREATE TABLE reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown
  report_type TEXT, -- research, analytics, cycle_review, etc.

  tags TEXT[],
  metadata JSONB DEFAULT '{}',

  created_by_agent_id BIGINT REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_company ON reports(company_id);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_created ON reports(created_at);
CREATE INDEX idx_reports_tags ON reports USING GIN(tags);
```

---

## Email & CRM Tables

### email_messages

```sql
CREATE TABLE email_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Email fields
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  is_transactional BOOLEAN DEFAULT false,

  -- Threading
  thread_id TEXT,
  in_reply_to TEXT,

  -- Status
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_company ON email_messages(company_id);
CREATE INDEX idx_email_direction ON email_messages(direction);
CREATE INDEX idx_email_thread ON email_messages(thread_id);
```

### contacts

```sql
CREATE TABLE contacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  title TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'replied', 'responded', 'meeting', 'customer', 'dead')),

  notes TEXT,
  tags TEXT[],

  last_contacted_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, email)
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_email ON contacts(email);
```

---

## Browser Auth Tables

### site_credentials

```sql
CREATE TABLE site_credentials (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  site TEXT NOT NULL, -- twitter.com, linkedin.com, etc.
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,

  notes TEXT,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, site)
);

CREATE INDEX idx_credentials_company ON site_credentials(company_id);
```

---

## Dashboard & Analytics Tables

### dashboard_links

```sql
CREATE TABLE dashboard_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,

  created_by_agent_id BIGINT REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_links_company ON dashboard_links(company_id);
```

### agent_metrics

```sql
CREATE TABLE agent_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  tasks_completed INT DEFAULT 0,
  tasks_failed INT DEFAULT 0,
  avg_score FLOAT,
  total_duration_seconds INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, date)
);

CREATE INDEX idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX idx_metrics_date ON agent_metrics(date);
```

---

## Subscription & Billing Tables

### subscriptions

```sql
CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  plan TEXT NOT NULL DEFAULT 'base' CHECK (plan IN ('base', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'suspended')),

  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Add-ons
  extra_companies INT DEFAULT 0, -- +$29/mo each
  extra_task_packs INT DEFAULT 0, -- +$29/mo each (30 tasks)

  -- Credits
  instant_tasks_remaining INT DEFAULT 15, -- Resets monthly
  instant_tasks_used INT DEFAULT 0,

  -- Billing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
```

---

## Cycle Tables

### cycles

```sql
CREATE TABLE cycles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  planned_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'executing', 'completed', 'failed')),

  -- Plan
  plan_reasoning TEXT,
  planned_tasks JSONB,

  -- Results
  tasks_created INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_failed INT DEFAULT 0,
  tasks_blocked INT DEFAULT 0,

  -- Review
  review_summary TEXT,
  accomplished JSONB,
  failed JSONB,
  blocked JSONB,
  tomorrow_priorities JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cycles_company ON cycles(company_id);
CREATE INDEX idx_cycles_status ON cycles(status);
CREATE INDEX idx_cycles_planned ON cycles(planned_at);
```

---

## Migration Strategy

**Idempotent migrations** for zero-downtime deploys:

```javascript
// migrations/001_users_and_companies.js
module.exports = {
  async up(db) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        ...
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  },

  async down(db) {
    // Rollback if needed
    await db.query(`DROP TABLE IF EXISTS users CASCADE;`);
  }
};
```

**Run migrations on every deploy:**
```bash
npm run migrate && npm start
```

---

## Database Best Practices

1. **Use transactions** for multi-table operations
2. **Add indexes** for all foreign keys
3. **Use JSONB** for flexible/nested data
4. **Avoid JOINs on JSONB** - denormalize if needed
5. **Use CHECK constraints** for enums
6. **Enable pg_stat_statements** for query analysis
7. **Use connection pooling** (pg-pool with 20 connections)
8. **Regular VACUUM** to prevent bloat

---

## Database Size Estimates

**Per company:**
- Tasks: ~10KB each × 1000 = 10MB
- Messages: ~2KB each × 10000 = 20MB
- Memory: ~100KB total
- Reports: ~10KB each × 100 = 1MB
- Executions: ~50KB each × 1000 = 50MB

**Total per company: ~100MB**

**For 100 companies: ~10GB**

**Neon free tier: 10GB** - sufficient for launch.
