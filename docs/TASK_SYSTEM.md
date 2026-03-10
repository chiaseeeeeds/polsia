# Task System

The task queue is the heart of Runloop. Every piece of work flows through this system - from creation to completion.

---

## Task Lifecycle

```
suggested → todo → in_progress → completed
                ↓              ↓
              rejected       failed
                             blocked
                            waiting
```

### State Definitions

| State | Meaning | Who Sets It |
|-------|---------|-------------|
| **suggested** | Proposed by agent, awaiting approval | Agent |
| **todo** | Approved and ready to execute | CEO or auto-approve |
| **in_progress** | Agent actively working on it | Worker (via start_task) |
| **blocked** | Stuck, waiting on external input | Agent |
| **waiting** | Paused, not urgent | Agent |
| **completed** | Successfully finished | Agent |
| **failed** | Attempted but couldn't complete | Agent |
| **rejected** | Owner or CEO declined it | CEO |

---

## Task Schema

```sql
CREATE TABLE tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),

  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL, -- WHAT to do + HOW to do it + context
  suggestion_reasoning TEXT NOT NULL, -- WHY it matters (business impact)

  -- Classification
  tag TEXT NOT NULL, -- engineering, research, browser, growth, content, data, support, meta_ads
  task_type TEXT NOT NULL, -- bug, feature, refactor, css, auth, seo, onboarding, infrastructure, copy, research, outreach
  task_category TEXT NOT NULL, -- engineering, research, growth, content, support, data, ops

  -- Routing
  suggested_agent_id BIGINT REFERENCES agents(id),
  assigned_agent_id BIGINT REFERENCES agents(id),

  -- Prioritization
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  complexity INT NOT NULL CHECK (complexity BETWEEN 1 AND 10),
  estimated_hours FLOAT NOT NULL CHECK (estimated_hours <= 4),
  queue_position INT, -- 1=top, 2=second, etc.

  -- Execution
  status TEXT NOT NULL DEFAULT 'suggested',
  executability_type TEXT NOT NULL, -- can_run_now, needs_new_connection, manual_task
  execution_id BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Context
  source TEXT, -- owner_request, agent_generated, monitoring, bug
  related_task_ids BIGINT[], -- linked tasks (e.g., bug links to original feature task)
  metadata JSONB DEFAULT '{}',

  -- Scoring
  score INT CHECK (score BETWEEN 1 AND 10),
  score_comment TEXT,
  scored_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_company_status ON tasks(company_id, status);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_queue ON tasks(company_id, status, queue_position);
CREATE INDEX idx_tasks_priority ON tasks(company_id, priority);
```

---

## Task Creation

### Required Fields

```javascript
{
  title: "Fix login button styling",
  description: "Login button on /login page has wrong color (blue instead of purple). Update to match brand: #8B5CF6. Test in Chrome, Firefox, Safari.",
  suggestion_reasoning: "Users report the blue button looks broken. Quick CSS fix improves perceived quality.",

  tag: "engineering",
  task_type: "css",
  task_category: "engineering",

  complexity: 2, // 1-10 scale
  estimated_hours: 0.25, // max 4 hours
  priority: "high", // low, medium, high, critical

  executability_type: "can_run_now", // can_run_now, needs_new_connection, manual_task
  suggested_agent_id: 30, // from find_agent_for_task

  source: "owner_request" // owner_request, agent_generated, monitoring, bug
}
```

### Field Guidelines

**title:** Clear, concise (under 80 chars)

**description:** 3 parts:
1. WHAT: The work to be done
2. HOW: Technical approach or specifics
3. CONTEXT: Links, screenshots, error messages, stack traces

**suggestion_reasoning:** Business justification:
- User impact
- Business value
- Urgency explanation

**tag:** Determines which agent picks it up

**complexity:** 1-10 scale
- 1-2: Trivial (typo fix, color change)
- 3-4: Simple (add validation, basic feature)
- 5-6: Moderate (new API endpoint, refactor)
- 7-8: Complex (authentication system, payment integration)
- 9-10: Very complex (multi-agent coordination, major refactor)

**estimated_hours:** Max 4 hours
- Tasks >4 hours get rejected
- Break into smaller tasks

**queue_position:** Use for critical work
- 1 = runs next
- 2 = second
- etc.
- If not set, appends to end

---

## Task Worker

**Polling interval:** 30 seconds

**Algorithm:**

```javascript
async function taskWorker() {
  while (true) {
    // 1. Find next task
    const task = await db.query(`
      SELECT * FROM tasks
      WHERE company_id = $1
        AND status = 'todo'
        AND executability_type = 'can_run_now'
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        queue_position NULLS LAST,
        created_at
      LIMIT 1
    `);

    if (!task) {
      await sleep(30000); // 30s
      continue;
    }

    // 2. Lock task
    await db.query(`
      UPDATE tasks
      SET status = 'in_progress',
          started_at = NOW(),
          assigned_agent_id = $1
      WHERE id = $2
    `, [task.suggested_agent_id, task.id]);

    // 3. Route to agent
    try {
      const agent = await getAgent(task.suggested_agent_id);
      const result = await executeAgent(agent, task);

      // 4. Handle result
      if (result.completed) {
        await completeTask(task.id, result.summary);
      } else if (result.blocked) {
        await blockTask(task.id, result.reason);
      } else if (result.failed) {
        await failTask(task.id, result.error);
      }
    } catch (error) {
      await handleExecutionError(task.id, error);
    }

    await sleep(1000); // Small delay before next
  }
}
```

---

## Task Execution

### Agent Execution Environment

```javascript
{
  task: {
    id: 12345,
    title: "...",
    description: "...",
    complexity: 5
  },
  company: {
    id: 42,
    name: "Acme Corp",
    slug: "acme-corp"
  },
  memory: {
    layer1: "...", // Domain knowledge
    layer2: "...", // Preferences
    layer3: "..."  // Cross-company patterns
  },
  tools: [...] // MCP tools for this agent
}
```

### Execution Steps

1. **Load context** - Memory, company docs, related tasks
2. **Execute agent** - LLM + tools loop
3. **Log every step** - For debugging and learning
4. **Handle timeouts** - Max execution time
5. **Retry on failure** - 3x with exponential backoff
6. **Update task status** - completed/failed/blocked

### Timeout Handling

| Complexity | Timeout | Retries |
|------------|---------|---------|
| 1-3 | 5 min | 3 |
| 4-6 | 15 min | 3 |
| 7-10 | 30 min | 2 |

---

## Agent Cross-Task Creation

**Agents can create tasks for OTHER agents = collaboration.**

**Example:**

Engineering agent discovers marketing opportunity:
```javascript
await create_task_proposal({
  title: "Tweet about new dark mode feature",
  description: "Just shipped dark mode. Draft tweet highlighting: (1) User requested (2) Shipped in 24h (3) Link to demo",
  suggestion_reasoning: "Launch announcement drives awareness and shows we ship fast",
  tag: "content",
  task_category: "content",
  task_type: "copy",
  complexity: 3,
  estimated_hours: 0.5,
  priority: "medium",
  executability_type: "can_run_now",
  suggested_agent_id: 53, // Twitter agent
  source: "agent_generated",
  related_task_ids: [12340] // Link to original dark mode task
});
```

---

## MCP Tools

### create_task_proposal

```javascript
await mcpClient.callTool('tasks', 'create_task_proposal', {
  title: "...",
  description: "...",
  suggestion_reasoning: "...",
  tag: "engineering",
  complexity: 5,
  estimated_hours: 2,
  // ... all required fields
});
```

Returns:
```javascript
{
  success: true,
  task_id: 12345,
  status: "suggested", // awaiting approval
  message: "Task created. Awaiting approval."
}
```

### get_available_tasks

```javascript
await mcpClient.callTool('tasks', 'get_available_tasks', {
  status: "todo",
  tag: "engineering",
  limit: 10
});
```

### start_task

```javascript
await mcpClient.callTool('tasks', 'start_task', {
  task_id: 12345,
  agent_name: "Engineering"
});
```

### complete_task

```javascript
await mcpClient.callTool('tasks', 'complete_task', {
  task_id: 12345,
  summary: "Fixed login button color. Tested in all browsers. Deployed.",
  agent_name: "Engineering"
});
```

### block_task

```javascript
await mcpClient.callTool('tasks', 'block_task', {
  task_id: 12345,
  reason: "Need design mockup before implementing",
  agent_name: "Engineering",
  use_status: "blocked" // or "waiting"
});
```

### fail_task

```javascript
await mcpClient.callTool('tasks', 'fail_task', {
  task_id: 12345,
  reason: "API credentials missing. Cannot connect to Stripe.",
  agent_name: "Engineering"
});
```

---

## Task Scoring

**After task completion, CEO asks user:**

"How'd Engineering do on that task? (1-10)"

**Scoring creates feedback loop:**
- 9-10: Agent nailed it
- 7-8: Met expectations
- 5-6: Partial success
- 3-4: Frustrated
- 1-2: Failed

**Scores feed routing intelligence:**
```javascript
await find_agent_for_task({
  query: "implement OAuth login"
});

// Returns agent with best historical scores for similar tasks
```

**Scoring API:**
```javascript
await mcpClient.callTool('tasks', 'score_task', {
  task_id: 12345,
  score: 9,
  comment: "Perfect. Deployed and working great."
});
```

---

## Task Queue Management

### Prioritization Rules

1. **Critical** tasks run first (security, bugs affecting all users)
2. **High** tasks run second (owner requests, revenue-impacting)
3. **Medium** tasks run third (improvements, features)
4. **Low** tasks run last (nice-to-haves)

Within same priority:
1. **queue_position** (if set) - explicit ordering
2. **created_at** - older first

### Queue Operations

**Move to top:**
```javascript
await mcpClient.callTool('tasks', 'move_to_top', {
  task_id: 12345
});
// Sets queue_position = 1, shifts others down
```

**Reorder:**
```javascript
await mcpClient.callTool('tasks', 'reorder_tasks', {
  task_ids: [12345, 12346, 12347] // new order
});
// Sets queue_position 1, 2, 3 respectively
```

---

## Task API Endpoints

### GET /api/tasks
```javascript
// Query: ?status=todo&tag=engineering&limit=20
{
  tasks: [
    {
      id: 12345,
      title: "...",
      status: "todo",
      priority: "high",
      complexity: 5,
      estimated_hours: 2,
      created_at: "...",
      suggested_agent: {
        id: 30,
        name: "Engineering"
      }
    }
  ],
  total: 147
}
```

### POST /api/tasks
```javascript
// Body: { title, description, ... }
{
  success: true,
  task_id: 12345,
  status: "suggested"
}
```

### GET /api/tasks/:id
```javascript
{
  id: 12345,
  title: "...",
  description: "...",
  status: "in_progress",
  execution: {
    id: 67890,
    started_at: "...",
    logs: [...]
  },
  related_tasks: [12340, 12341]
}
```

### POST /api/tasks/:id/approve
```javascript
{
  success: true,
  message: "Task approved and queued"
}
```

### POST /api/tasks/:id/reject
```javascript
// Body: { reason: "..." }
{
  success: true,
  message: "Task rejected"
}
```

### POST /api/tasks/:id/score
```javascript
// Body: { score: 9, comment: "..." }
{
  success: true,
  message: "Task scored"
}
```

### GET /api/tasks/:id/execution
```javascript
{
  execution_id: 67890,
  task_id: 12345,
  started_at: "...",
  completed_at: "...",
  logs: [
    {
      timestamp: "...",
      type: "tool_call",
      tool: "write_file",
      params: {...},
      result: {...}
    }
  ],
  thinking: "...",
  result: "..."
}
```

---

## Task Dashboard UI

**Located at:** `/dashboard/tasks`

**Views:**

1. **Queue View** - All todo tasks, draggable reordering
2. **In Progress** - Currently executing tasks with live logs
3. **Completed** - Recent completions with scores
4. **All Tasks** - Filterable, searchable list

**Design:**
```
┌────────────────────────────────────────────────┐
│  Tasks  [Queue] [In Progress] [Completed] [All]│
├────────────────────────────────────────────────┤
│  🔴 Critical (2) | 🟠 High (8) | 🟡 Medium (23) │
├────────────────────────────────────────────────┤
│  [Drag to reorder]                             │
│                                                │
│  1️⃣ Fix login button (Engineering)            │
│     High • 0.25h • Created 2h ago              │
│     [View] [Edit] [Move to Top]                │
│                                                │
│  2️⃣ Research competitors (Research)           │
│     Medium • 2h • Created 1d ago               │
│     [View] [Edit] [Move to Top]                │
└────────────────────────────────────────────────┘
```

---

## Task Notifications

**send_reply during execution:**

```javascript
// Agent can push updates to chat
await send_reply({
  message: "Starting login bug fix...",
  agent_name: "Engineering"
});

// Later...
await send_reply({
  message: "Deployed. Test at https://app.runloop.com/login",
  agent_name: "Engineering"
});
```

**User sees real-time updates in chat = platform feels ALIVE.**

---

## Advanced Features

### 1. Recurring Tasks

Tasks can spawn from recurring templates:

```sql
CREATE TABLE recurring_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  template JSONB NOT NULL, -- task fields
  frequency TEXT NOT NULL, -- daily, weekdays, weekly, monthly
  next_run_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN DEFAULT true
);
```

**Example:**
```javascript
{
  template: {
    title: "Weekly analytics report",
    description: "Pull metrics, create report with trends",
    tag: "data",
    complexity: 4,
    estimated_hours: 1
  },
  frequency: "weekly", // every Monday
  next_run_at: "2026-03-08T09:00:00Z"
}
```

### 2. Task Dependencies

Tasks can wait for other tasks:

```javascript
{
  title: "Deploy to production",
  description: "...",
  dependencies: [12340, 12341], // must complete first
  ...
}
```

Worker checks dependencies before executing.

### 3. Task Templates

Common task types have templates:

```javascript
const BUG_TEMPLATE = {
  task_type: "bug",
  priority: "high",
  description: `
    **Bug:** [describe what's broken]
    **Expected:** [what should happen]
    **Steps to reproduce:**
    1. [step]
    2. [step]
    **Screenshots:** [link]
    **Browser/device:** [info]
  `
};
```

CEO uses templates to ensure consistency.

---

## Performance Considerations

**Queue depth:** Unlimited, but prioritization ensures critical work runs first

**Polling:** 30s interval, low overhead

**Execution concurrency:** 1 task per agent at a time (prevents conflicts)

**Retry strategy:** Exponential backoff prevents thundering herd

**Database indexes:** Optimized for common queries (status, priority, queue_position)

---

## Future Enhancements

(Not in V1)

- Parallel task execution (multiple agents of same type)
- Task scheduling (run at specific time)
- Approval workflows (multiple approvers)
- Task milestones (break large tasks into phases)
- Automatic task splitting (>4h tasks)
- Task estimation learning (improve estimates over time)
