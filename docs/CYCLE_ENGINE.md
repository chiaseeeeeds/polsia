# Cycle Engine

Nightly autonomous planning and execution system. The cycle engine makes Runloop truly autonomous - every night, it plans work, executes tasks, and reports results.

---

## Overview

**The cycle engine runs every night at midnight (company timezone).**

It's what makes Runloop different from a chatbot - work happens automatically, without waiting for user input.

---

## Cycle Lifecycle

```
Planning (11:30 PM) → Execution (12:00 AM - 6:00 AM) → Review (6:00 AM)
```

### 1. Planning Phase (11:30 PM)

**Trigger:** Cron job at 11:30 PM

**Steps:**
1. Call `get_cycle_context()` - Gather all company context
2. CEO analyzes context and creates plan
3. Call `create_cycle_plan()` - Save tonight's plan
4. Plan creates tasks for each agent

**Context gathered:**
- Company documents (mission, product, tech notes, brand voice)
- Current task queue (what's pending)
- Memory (recent learnings, preferences)
- Infrastructure status (deployed apps, health)
- Recent activity (last 7 days of completions)
- Open issues (failed/blocked tasks)

**Planning prompt:**
```
You are planning tonight's autonomous work cycle for {{company_name}}.

## Context:
{context from get_cycle_context}

## Your Job:
Create 3-8 tasks that will move the business forward tonight. Prioritize:
1. Critical bugs or blockers
2. Owner-requested work
3. High-value features
4. Growth activities (outreach, content)
5. Infrastructure maintenance

## Constraints:
- Total estimated time: 4-6 hours across all agents
- Each agent works sequentially (no parallel execution yet)
- Must be executable without human input
- No tasks requiring new API connections

## Output Format:
{
  tasks: [
    {
      title: "...",
      description: "...",
      tag: "engineering",
      complexity: 5,
      estimated_hours: 2,
      reasoning: "Why this task tonight"
    }
  ],
  reasoning: "Overall plan rationale"
}
```

### 2. Execution Phase (12:00 AM - 6:00 AM)

**Normal task worker runs** - picks up tasks created by planning

**Tasks execute sequentially** per agent type

**Real-time logging** - Every action logged to database

**Agents collaborate** - Can create tasks for other agents

### 3. Review Phase (6:00 AM)

**Trigger:** Cron job at 6:00 AM or when all cycle tasks complete

**Steps:**
1. Gather results (completed, failed, blocked)
2. Call `submit_review()` with summary
3. Increment `cycles_completed` counter
4. Generate morning summary for user

**Review format:**
```
{
  cycle_id: 1234,
  accomplished: [
    {
      task_id: 12345,
      title: "Fixed login bug",
      score: 9,
      outcome: "Deployed and tested"
    }
  ],
  failed: [
    {
      task_id: 12346,
      title: "Add OAuth",
      reason: "Missing credentials"
    }
  ],
  blocked: [
    {
      task_id: 12347,
      title: "Design homepage",
      reason: "Awaiting owner feedback"
    }
  ],
  tomorrow_priorities: [
    "Complete OAuth setup",
    "Launch email campaign",
    "Optimize database queries"
  ]
}
```

---

## Database Schema

```sql
CREATE TABLE cycles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),

  -- Lifecycle
  planned_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planning', -- planning, executing, completed, failed

  -- Plan
  plan_reasoning TEXT,
  planned_tasks JSONB, -- Array of task templates

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

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cycles_company ON cycles(company_id);
CREATE INDEX idx_cycles_status ON cycles(status);
```

---

## MCP Tools

### get_cycle_context

**Gathers all context needed for planning**

```javascript
await mcpClient.callTool('cycle_planning', 'get_cycle_context', {
  include_docs: true,
  include_tasks: true,
  include_memory: true,
  include_infrastructure: true
});
```

Returns:
```javascript
{
  success: true,
  context: {
    company: {
      name: "Acme Corp",
      slug: "acme-corp",
      cycles_completed: 42
    },
    documents: {
      mission: "...",
      product_overview: "...",
      tech_notes: "..."
    },
    tasks: {
      pending: 8,
      in_progress: 1,
      recently_completed: [...]
    },
    memory: {
      layer1: "...",
      layer2: "..."
    },
    infrastructure: {
      instances: [
        {
          id: 4295,
          name: "Production",
          status: "healthy",
          last_deploy: "2026-03-03"
        }
      ]
    },
    recent_activity: {
      last_7_days: {
        completed: 12,
        failed: 2,
        average_score: 8.1
      }
    }
  }
}
```

### create_cycle_plan

**Create tonight's cycle plan**

```javascript
await mcpClient.callTool('cycle_planning', 'create_cycle_plan', {
  tasks: [
    {
      title: "Optimize database queries",
      description: "...",
      tag: "engineering",
      complexity: 6,
      estimated_hours: 2,
      reasoning: "Response time increased 30% this week"
    }
  ],
  reasoning: "Focusing on performance and stability before launching new features"
});
```

Returns:
```javascript
{
  success: true,
  cycle_id: 1234,
  tasks_created: 5,
  estimated_completion: "2026-03-04T04:30:00Z"
}
```

### update_cycle_plan

**Modify active cycle** (rarely used - usually plans execute as-is)

```javascript
await mcpClient.callTool('cycle_planning', 'update_cycle_plan', {
  cycle_id: 1234,
  updates: {
    add_tasks: [...],
    remove_task_ids: [12345]
  }
});
```

### submit_review

**Submit cycle results** (called by review phase)

```javascript
await mcpClient.callTool('cycle_planning', 'submit_review', {
  cycle_id: 1234,
  accomplished: [
    {
      task_id: 12345,
      title: "Fixed login bug",
      outcome: "Deployed and working"
    }
  ],
  failed: [
    {
      task_id: 12346,
      reason: "Missing API key"
    }
  ],
  tomorrow_priorities: [
    "Complete OAuth",
    "Launch campaign"
  ]
});
```

Returns:
```javascript
{
  success: true,
  cycle_id: 1234,
  cycles_completed: 43, // Incremented
  summary_created: true
}
```

---

## Cron Jobs

**Implementation:** Node-cron or database-based scheduler

### Planning Job
```javascript
cron.schedule('30 23 * * *', async () => {
  const companies = await getActiveCompanies();

  for (const company of companies) {
    try {
      await runCyclePlanning(company.id);
    } catch (error) {
      console.error(`Cycle planning failed for ${company.name}:`, error);
    }
  }
});
```

### Review Job
```javascript
cron.schedule('0 6 * * *', async () => {
  const activeCycles = await getActiveCycles();

  for (const cycle of activeCycles) {
    try {
      await runCycleReview(cycle.id);
    } catch (error) {
      console.error(`Cycle review failed for cycle ${cycle.id}:`, error);
    }
  }
});
```

---

## Morning Summary

**User receives summary at 6 AM** via chat notification:

```
Good morning! Overnight progress:

✅ Fixed login button styling (Engineering, 9/10)
✅ Researched 5 competitors (Research, 8/10)
✅ Tweeted about dark mode launch (Twitter)
⚠️ OAuth setup blocked - need credentials

Today's priorities:
1. Complete OAuth integration
2. Launch email campaign
3. Optimize database queries

Cycles completed: 43
```

**Implementation:**
```javascript
async function generateMorningSummary(cycleId) {
  const review = await getCycleReview(cycleId);

  const completed = review.accomplished.map(t =>
    `✅ ${t.title} (${t.agent}, ${t.score || 'no score'}/10)`
  ).join('\n');

  const failed = review.failed.map(t =>
    `❌ ${t.title} - ${t.reason}`
  ).join('\n');

  const blocked = review.blocked.map(t =>
    `⚠️ ${t.title} - ${t.reason}`
  ).join('\n');

  const priorities = review.tomorrow_priorities.map((p, i) =>
    `${i + 1}. ${p}`
  ).join('\n');

  return `
Good morning! Overnight progress:

${completed}
${failed}
${blocked}

Today's priorities:
${priorities}

Cycles completed: ${review.cycles_completed}
  `.trim();
}
```

---

## Planning Strategy

**CEO uses this logic for cycle planning:**

### 1. Critical First
- Security issues
- Bugs affecting all users
- Infrastructure down

### 2. Owner Requests
- Explicitly requested features
- Feedback responses

### 3. High-Value Work
- Revenue-generating features
- User-requested improvements
- Growth activities

### 4. Maintenance
- Dependency updates
- Performance optimization
- Tech debt reduction

### 5. Exploration
- Research competitors
- Test new ideas
- Gather data

**Max 3-8 tasks per cycle** to ensure quality over quantity.

---

## Execution Strategy

### Agent Sequencing

**Per agent type, tasks run sequentially:**
- Engineering task 1 → Engineering task 2 → Engineering task 3
- Research task 1 → Research task 2

**Cross-agent runs in parallel:**
- Engineering task 1 (running)
- Research task 1 (running)
- Twitter task 1 (running)

**In V1:** Sequential only (simpler, more reliable)

**In V2:** Parallel per agent type

### Time Budgeting

**6-hour execution window** (midnight to 6 AM)

**Budget per agent:**
- Engineering: 3 hours
- Research: 1 hour
- Growth: 1 hour
- Content: 0.5 hours
- Data: 0.5 hours

**If tasks exceed budget** → spillover to next cycle

---

## Failure Handling

**Task fails during cycle:**
1. Log failure reason
2. Mark task as failed
3. Continue with next task
4. Include in morning summary

**Agent crashes:**
1. Retry 3x with exponential backoff
2. If still failing, skip and log
3. Alert platform team (via polsia_support)

**Entire cycle fails:**
1. Log error
2. Send emergency notification
3. Manual review required

---

## Cycle Metrics

**Track these metrics per cycle:**

```sql
CREATE TABLE cycle_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES cycles(id),

  -- Performance
  total_duration_seconds INT,
  avg_task_duration_seconds INT,

  -- Quality
  avg_task_score FLOAT,
  completion_rate FLOAT, -- completed / total

  -- Activity
  tools_called INT,
  api_calls_made INT,
  files_modified INT,
  deployments_triggered INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Dashboard shows:**
- Completion rate over time
- Average scores per cycle
- Most productive agents
- Common failure patterns

---

## User Control

**Users can:**
1. **Disable cycles** - "Pause autonomous work"
2. **Adjust frequency** - Daily, weekdays only, weekly
3. **Set focus** - "Prioritize growth" or "Prioritize stability"
4. **Review before execution** - Approve plan before tasks run (optional)

**Settings UI:**
```
┌────────────────────────────────────────┐
│  Autonomous Cycles                     │
├────────────────────────────────────────┤
│  [ON] Run cycles automatically         │
│                                        │
│  Frequency: [Daily ▾]                  │
│  Time: [11:30 PM ▾]                    │
│                                        │
│  Focus:                                │
│  ( ) Stability - Fix bugs, optimize   │
│  (•) Balanced - Mix of features/fixes │
│  ( ) Growth - Marketing, outreach     │
│                                        │
│  [ ] Require approval before running  │
│                                        │
│  [Save Settings]                       │
└────────────────────────────────────────┘
```

---

## API Endpoints

### POST /api/cycles/plan
```javascript
// Manually trigger planning
{
  success: true,
  cycle_id: 1234,
  tasks_created: 5
}
```

### GET /api/cycles
```javascript
// List recent cycles
{
  cycles: [
    {
      id: 1234,
      planned_at: "2026-03-03T23:30:00Z",
      status: "completed",
      tasks_completed: 5,
      tasks_failed: 1,
      avg_score: 8.2
    }
  ]
}
```

### GET /api/cycles/:id
```javascript
// Get cycle details
{
  id: 1234,
  status: "completed",
  plan_reasoning: "...",
  accomplished: [...],
  failed: [...],
  review_summary: "..."
}
```

---

## Cycle Dashboard UI

**Located at:** `/dashboard/cycles`

**Shows:**
- Current cycle status (if active)
- Recent cycles with completion rates
- Cycle calendar (visual history)
- Metrics over time

**Design:**
```
┌────────────────────────────────────────────┐
│  Autonomous Cycles                         │
├────────────────────────────────────────────┤
│  📊 43 cycles completed                    │
│  ✅ 87% completion rate                    │
│  ⭐ 8.2 average score                      │
├────────────────────────────────────────────┤
│  🌙 Tonight's Plan (11:30 PM)             │
│  ├─ Fix dashboard loading (Engineering)   │
│  ├─ Research growth channels (Research)   │
│  └─ Tweet product update (Twitter)        │
│                                            │
│  Recent Cycles:                            │
│  ✅ Mar 3 - 5 tasks, 8.4 avg score        │
│  ✅ Mar 2 - 4 tasks, 7.8 avg score        │
│  ⚠️ Mar 1 - 3 tasks, 2 failed             │
└────────────────────────────────────────────┘
```

---

## Future Enhancements

(Not in V1)

- Multi-cycle planning (plan week ahead)
- Learning from past cycles (optimize timing)
- User feedback on plans ("Focus on X this week")
- Parallel execution per agent type
- Emergency cycles (run immediately)
- Cycle templates (common patterns)
