# API Endpoints

Complete REST API specification for Runloop. Every endpoint, every parameter, every response.

---

## Authentication

All endpoints (except public ones) require authentication via session cookie.

**Session cookie:** `runloop_session` (HttpOnly, Secure, SameSite=Lax)

**Unauthenticated requests:** Return 401 with `{ error: "Unauthorized" }`

---

## Auth Endpoints

### POST /api/auth/signup
Create new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}
```

**Response:** 201
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Errors:**
- 400: Email already exists
- 400: Invalid email format
- 400: Password too short (min 8 chars)

### POST /api/auth/login
Login existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:** 200
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Errors:**
- 401: Invalid credentials

### POST /api/auth/logout
Logout current user.

**Response:** 200
```json
{
  "success": true
}
```

### GET /api/auth/me
Get current user info.

**Response:** 200
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "companies": [
      {
        "id": 42,
        "name": "Acme Corp",
        "slug": "acme-corp",
        "cycles_completed": 43
      }
    ]
  }
}
```

**Errors:**
- 401: Not authenticated

---

## Company Endpoints

### POST /api/companies
Create new company.

**Request:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "description": "B2B SaaS platform",
  "website": "https://acme.com",
  "industry": "SaaS"
}
```

**Response:** 201
```json
{
  "success": true,
  "company": {
    "id": 42,
    "name": "Acme Corp",
    "slug": "acme-corp",
    "cycles_completed": 0
  }
}
```

### GET /api/companies/:id
Get company details.

**Response:** 200
```json
{
  "company": {
    "id": 42,
    "name": "Acme Corp",
    "slug": "acme-corp",
    "description": "...",
    "cycles_completed": 43,
    "tasks_completed": 247,
    "cycles_enabled": true
  }
}
```

### PUT /api/companies/:id
Update company.

**Request:**
```json
{
  "name": "Acme Corporation",
  "description": "Updated description"
}
```

**Response:** 200
```json
{
  "success": true,
  "company": {...}
}
```

---

## Chat Endpoints

### GET /api/conversations
List conversations for current company.

**Query params:**
- `limit` (default: 20)
- `offset` (default: 0)

**Response:** 200
```json
{
  "conversations": [
    {
      "id": 123,
      "title": "Initial setup discussion",
      "message_count": 45,
      "last_message_at": "2026-03-04T04:30:00Z",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 5
}
```

### POST /api/conversations
Create new conversation.

**Request:**
```json
{
  "title": "New chat"
}
```

**Response:** 201
```json
{
  "success": true,
  "conversation": {
    "id": 124,
    "title": "New chat",
    "message_count": 0
  }
}
```

### GET /api/conversations/:id/messages
Get messages in conversation.

**Query params:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** 200
```json
{
  "messages": [
    {
      "id": 1001,
      "role": "user",
      "content": "Fix the login button",
      "created_at": "2026-03-04T04:00:00Z"
    },
    {
      "id": 1002,
      "role": "assistant",
      "content": "Creating task for Engineering.",
      "agent_name": "CEO",
      "tool_calls": [
        {
          "tool": "create_task_proposal",
          "params": {...},
          "result": {...}
        }
      ],
      "created_at": "2026-03-04T04:00:05Z"
    }
  ],
  "total": 45
}
```

### POST /api/conversations/:id/messages
Send message in conversation.

**Request:**
```json
{
  "content": "Fix the login button"
}
```

**Response:** 201
```json
{
  "success": true,
  "message": {
    "id": 1001,
    "role": "user",
    "content": "Fix the login button",
    "created_at": "2026-03-04T04:00:00Z"
  }
}
```

**Note:** This triggers CEO to process the message and respond.

### GET /api/conversations/:id/stream
**Server-Sent Events (SSE)** stream for real-time messages.

**Response:** SSE stream
```
event: message
data: {"id": 1002, "role": "assistant", "content": "Creating task..."}

event: message
data: {"id": 1003, "role": "assistant", "content": "Task created."}

event: done
data: {}
```

---

## Task Endpoints

### GET /api/tasks
List tasks.

**Query params:**
- `status` - suggested, todo, in_progress, completed, failed, blocked
- `tag` - engineering, research, etc.
- `priority` - low, medium, high, critical
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** 200
```json
{
  "tasks": [
    {
      "id": 12345,
      "title": "Fix login button",
      "description": "...",
      "status": "todo",
      "priority": "high",
      "complexity": 3,
      "estimated_hours": 0.5,
      "tag": "engineering",
      "suggested_agent": {
        "id": 30,
        "name": "Engineering"
      },
      "created_at": "2026-03-04T03:00:00Z"
    }
  ],
  "total": 147
}
```

### POST /api/tasks
Create new task.

**Request:**
```json
{
  "title": "Fix login button",
  "description": "Login button has wrong color...",
  "suggestion_reasoning": "Users report it looks broken",
  "tag": "engineering",
  "task_type": "css",
  "task_category": "engineering",
  "complexity": 3,
  "estimated_hours": 0.5,
  "priority": "high",
  "executability_type": "can_run_now",
  "suggested_agent_id": 30
}
```

**Response:** 201
```json
{
  "success": true,
  "task_id": 12345,
  "status": "suggested"
}
```

### GET /api/tasks/:id
Get task details.

**Response:** 200
```json
{
  "task": {
    "id": 12345,
    "title": "Fix login button",
    "description": "...",
    "status": "in_progress",
    "execution": {
      "id": 67890,
      "started_at": "2026-03-04T04:10:00Z",
      "logs": [...]
    },
    "related_tasks": [12340, 12341]
  }
}
```

### POST /api/tasks/:id/approve
Approve suggested task.

**Response:** 200
```json
{
  "success": true,
  "message": "Task approved and queued"
}
```

### POST /api/tasks/:id/reject
Reject suggested task.

**Request:**
```json
{
  "reason": "Not a priority right now"
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Task rejected"
}
```

### POST /api/tasks/:id/score
Score completed task.

**Request:**
```json
{
  "score": 9,
  "comment": "Perfect. Deployed and working."
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Task scored"
}
```

### POST /api/tasks/reorder
Reorder task queue.

**Request:**
```json
{
  "task_ids": [12345, 12346, 12347]
}
```

**Response:** 200
```json
{
  "success": true,
  "message": "Tasks reordered"
}
```

### POST /api/tasks/:id/move-to-top
Move task to top of queue.

**Response:** 200
```json
{
  "success": true,
  "queue_position": 1
}
```

### GET /api/tasks/:id/execution
Get task execution logs.

**Response:** 200
```json
{
  "execution": {
    "id": 67890,
    "task_id": 12345,
    "agent": {
      "id": 30,
      "name": "Engineering"
    },
    "status": "completed",
    "started_at": "2026-03-04T04:10:00Z",
    "completed_at": "2026-03-04T04:25:00Z",
    "duration_seconds": 900,
    "logs": [
      {
        "timestamp": "2026-03-04T04:10:05Z",
        "type": "tool_call",
        "tool": "read_file",
        "params": {"file_path": "public/login.html"},
        "result": {...}
      }
    ],
    "thinking": "I need to update the button color...",
    "result": "Deployed. Button is now purple."
  }
}
```

### GET /api/tasks/:id/run-link
Get shareable link to task execution.

**Response:** 200
```json
{
  "link": "https://runloop.polsia.app/tasks/12345/run"
}
```

---

## Agent Endpoints

### GET /api/agents
List agents for current company.

**Response:** 200
```json
{
  "agents": [
    {
      "id": 30,
      "name": "Engineering",
      "type": "execution",
      "is_active": true,
      "tasks_completed": 247,
      "avg_score": 8.2,
      "last_run_at": "2026-03-04T04:00:00Z"
    }
  ]
}
```

### GET /api/agents/:id
Get agent details.

**Response:** 200
```json
{
  "agent": {
    "id": 30,
    "name": "Engineering",
    "system_prompt": "You are the Engineering agent...",
    "model": "gpt-4-turbo",
    "max_turns": 200,
    "tasks_completed": 247,
    "avg_score": 8.2,
    "tools": ["tasks", "polsia_infra", "reports", ...]
  }
}
```

### POST /api/agents
Create custom agent.

**Request:**
```json
{
  "name": "Designer",
  "system_prompt": "You are the Design specialist...",
  "mcp_servers": ["tasks", "reports"],
  "model": "gpt-4",
  "max_turns": 100
}
```

**Response:** 201
```json
{
  "success": true,
  "agent": {
    "id": 55,
    "name": "Designer",
    "type": "custom"
  }
}
```

### PUT /api/agents/:id
Update agent.

**Request:**
```json
{
  "system_prompt": "Updated prompt...",
  "is_active": false
}
```

**Response:** 200
```json
{
  "success": true,
  "agent": {...}
}
```

### GET /api/agents/:id/metrics
Get agent performance metrics.

**Query params:**
- `days` (default: 30)

**Response:** 200
```json
{
  "metrics": {
    "tasks_completed": 247,
    "tasks_failed": 12,
    "avg_score": 8.2,
    "completion_rate": 0.95,
    "avg_duration_minutes": 15,
    "by_day": [
      {
        "date": "2026-03-04",
        "completed": 5,
        "failed": 0,
        "avg_score": 8.8
      }
    ]
  }
}
```

---

## Memory Endpoints

### GET /api/memory/search
Search across memory layers.

**Query params:**
- `q` - Search query
- `layers` - Comma-separated (1,2,3)
- `limit` (default: 5)

**Response:** 200
```json
{
  "results": [
    {
      "layer": 1,
      "content": "Authentication uses JWT...",
      "relevance": 0.87,
      "last_accessed_at": "2026-03-03T10:00:00Z"
    }
  ]
}
```

### GET /api/memory/layer/:layerId
Get full memory layer content.

**Response:** 200
```json
{
  "layer": 1,
  "content": "# Domain Knowledge\n\n## Authentication\n...",
  "token_count": 8234,
  "last_updated": "2026-03-03T22:00:00Z"
}
```

### PUT /api/memory/layer/:layerId
Update memory layer (Layer 2 only via UI).

**Request:**
```json
{
  "content": "# Company Preferences\n\nOwner prefers dark mode..."
}
```

**Response:** 200
```json
{
  "success": true,
  "token_count": 2847
}
```

---

## Document Endpoints

### GET /api/documents
Get all company documents.

**Response:** 200
```json
{
  "documents": [
    {
      "type": "mission",
      "content": "Our mission is to...",
      "updated_at": "2026-03-01T10:00:00Z"
    },
    {
      "type": "product_overview",
      "content": "Runloop is an autonomous...",
      "updated_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

### GET /api/documents/:type
Get specific document.

**Response:** 200
```json
{
  "document": {
    "type": "mission",
    "content": "Our mission is to...",
    "updated_at": "2026-03-01T10:00:00Z"
  }
}
```

### PUT /api/documents/:type
Update document.

**Request:**
```json
{
  "content": "Updated mission statement..."
}
```

**Response:** 200
```json
{
  "success": true,
  "document": {...}
}
```

---

## Report Endpoints

### GET /api/reports
List reports.

**Query params:**
- `report_type` - research, analytics, cycle_review
- `tags` - Comma-separated
- `limit` (default: 20)
- `offset` (default: 0)

**Response:** 200
```json
{
  "reports": [
    {
      "id": 1001,
      "title": "Competitor Analysis",
      "report_type": "research",
      "tags": ["market", "competition"],
      "created_by": {
        "id": 29,
        "name": "Research"
      },
      "created_at": "2026-03-04T02:00:00Z"
    }
  ],
  "total": 45
}
```

### POST /api/reports
Create report.

**Request:**
```json
{
  "title": "Competitor Analysis",
  "content": "# Executive Summary\n\n...",
  "report_type": "research",
  "tags": ["market", "competition"]
}
```

**Response:** 201
```json
{
  "success": true,
  "report_id": 1001
}
```

### GET /api/reports/:id
Get report.

**Response:** 200
```json
{
  "report": {
    "id": 1001,
    "title": "Competitor Analysis",
    "content": "# Executive Summary\n\n...",
    "report_type": "research",
    "tags": ["market", "competition"],
    "created_by": {
      "id": 29,
      "name": "Research"
    },
    "created_at": "2026-03-04T02:00:00Z"
  }
}
```

### GET /api/reports/search
Search reports by content.

**Query params:**
- `q` - Search query
- `last_n_days` (default: 30)
- `limit` (default: 20)

**Response:** 200
```json
{
  "results": [
    {
      "id": 1001,
      "title": "Competitor Analysis",
      "excerpt": "...found 5 key competitors...",
      "relevance": 0.89,
      "created_at": "2026-03-04T02:00:00Z"
    }
  ]
}
```

---

## Workflow Endpoints

### GET /api/workflows
List workflows.

**Response:** 200
```json
{
  "workflows": [
    {
      "id": 201,
      "name": "Launch Checklist",
      "description": "Full launch sequence",
      "trigger_type": "manual",
      "enabled": true,
      "created_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

### POST /api/workflows
Create workflow.

**Request:**
```json
{
  "name": "Launch Checklist",
  "description": "Full launch sequence",
  "trigger_type": "manual",
  "steps": [
    {
      "agent_id": 30,
      "task_template": {
        "title": "Final testing",
        "description": "...",
        "tag": "engineering"
      },
      "wait_for_completion": true
    }
  ]
}
```

**Response:** 201
```json
{
  "success": true,
  "workflow_id": 201
}
```

### POST /api/workflows/:id/run
Execute workflow.

**Response:** 200
```json
{
  "success": true,
  "run_id": 301,
  "tasks_created": [12345, 12346, 12347]
}
```

### GET /api/workflows/:id/runs
Get workflow execution history.

**Response:** 200
```json
{
  "runs": [
    {
      "id": 301,
      "status": "completed",
      "started_at": "2026-03-04T03:00:00Z",
      "completed_at": "2026-03-04T04:30:00Z",
      "tasks_created": [12345, 12346, 12347]
    }
  ]
}
```

---

## Recurring Task Endpoints

### GET /api/recurring-tasks
List recurring tasks.

**Response:** 200
```json
{
  "recurring_tasks": [
    {
      "id": 401,
      "title": "Weekly analytics report",
      "frequency": "weekly",
      "enabled": true,
      "next_run_at": "2026-03-08T09:00:00Z",
      "last_run_at": "2026-03-01T09:00:00Z"
    }
  ]
}
```

### POST /api/recurring-tasks
Create recurring task.

**Request:**
```json
{
  "title": "Weekly analytics report",
  "template": {
    "description": "Pull metrics and create report",
    "tag": "data",
    "complexity": 4,
    "estimated_hours": 1
  },
  "frequency": "weekly"
}
```

**Response:** 201
```json
{
  "success": true,
  "recurring_task_id": 401,
  "next_run_at": "2026-03-08T09:00:00Z"
}
```

### PUT /api/recurring-tasks/:id
Update recurring task.

**Request:**
```json
{
  "enabled": false
}
```

**Response:** 200
```json
{
  "success": true
}
```

### DELETE /api/recurring-tasks/:id
Delete recurring task.

**Response:** 200
```json
{
  "success": true
}
```

---

## Email Endpoints

### GET /api/email/inbox
Get email inbox.

**Query params:**
- `direction` - inbound, outbound
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** 200
```json
{
  "emails": [
    {
      "id": 5001,
      "from_email": "prospect@example.com",
      "to_email": "acme@polsia.app",
      "subject": "Interested in your product",
      "direction": "inbound",
      "received_at": "2026-03-04T03:00:00Z",
      "read_at": null
    }
  ],
  "total": 23
}
```

### POST /api/email/send
Send email.

**Request:**
```json
{
  "to": "prospect@example.com",
  "subject": "Re: Interested in your product",
  "body": "Thanks for reaching out...",
  "is_transactional": false
}
```

**Response:** 200
```json
{
  "success": true,
  "email_id": 5002,
  "sent_at": "2026-03-04T04:00:00Z"
}
```

**Rate limits:**
- Cold outreach: 2/day
- Replies: unlimited
- Transactional: unlimited

### GET /api/email/contacts
Get CRM contacts.

**Query params:**
- `status` - pending, contacted, replied, etc.
- `limit` (default: 50)

**Response:** 200
```json
{
  "contacts": [
    {
      "id": 601,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "company": "Acme Corp",
      "status": "replied",
      "last_contacted_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 87
}
```

### POST /api/email/contacts
Add contact.

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "company": "Acme Corp",
  "notes": "Met at conference"
}
```

**Response:** 201
```json
{
  "success": true,
  "contact_id": 601
}
```

---

## Dashboard Endpoints

### GET /api/dashboard
Get dashboard overview.

**Response:** 200
```json
{
  "overview": {
    "tasks": {
      "todo": 8,
      "in_progress": 2,
      "completed_today": 5
    },
    "agents": {
      "active": 8,
      "idle": 0
    },
    "cycles_completed": 43,
    "recent_activity": [...]
  }
}
```

### GET /api/dashboard/links
Get dashboard links.

**Response:** 200
```json
{
  "links": [
    {
      "id": 701,
      "title": "Production App",
      "url": "https://app.acme.com",
      "description": "Main application",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

### POST /api/dashboard/links
Add dashboard link.

**Request:**
```json
{
  "title": "Production App",
  "url": "https://app.acme.com",
  "description": "Main application"
}
```

**Response:** 201
```json
{
  "success": true,
  "link_id": 701
}
```

---

## Analytics Endpoints

### GET /api/analytics/overview
Get analytics overview.

**Query params:**
- `days` (default: 30)

**Response:** 200
```json
{
  "analytics": {
    "tasks": {
      "completed": 247,
      "failed": 12,
      "avg_score": 8.2,
      "completion_rate": 0.95
    },
    "agents": {
      "most_active": {
        "id": 30,
        "name": "Engineering",
        "tasks_completed": 145
      }
    },
    "cycles": {
      "completed": 43,
      "avg_tasks_per_cycle": 5.7
    }
  }
}
```

### GET /api/analytics/agents
Get agent analytics.

**Response:** 200
```json
{
  "agents": [
    {
      "id": 30,
      "name": "Engineering",
      "tasks_completed": 145,
      "avg_score": 8.2,
      "completion_rate": 0.97
    }
  ]
}
```

### GET /api/analytics/tasks
Get task analytics.

**Response:** 200
```json
{
  "tasks": {
    "by_tag": {
      "engineering": 145,
      "research": 45,
      "growth": 32
    },
    "by_status": {
      "completed": 247,
      "failed": 12,
      "in_progress": 2
    },
    "avg_completion_time_hours": 0.75
  }
}
```

---

## Capabilities Endpoints

### GET /api/capabilities/agents
List available agent types.

**Response:** 200
```json
{
  "agents": [
    {
      "id": 30,
      "name": "Engineering",
      "type": "execution",
      "capabilities": ["code", "deploy", "debug"]
    }
  ]
}
```

### GET /api/capabilities/tools
List available MCP tools.

**Response:** 200
```json
{
  "tools": [
    {
      "server": "tasks",
      "tools": ["create_task_proposal", "get_available_tasks", ...]
    }
  ]
}
```

### POST /api/capabilities/find-agent
Find best agent for task.

**Request:**
```json
{
  "query": "implement OAuth login"
}
```

**Response:** 200
```json
{
  "recommended_agent_id": 30,
  "confidence": 0.87,
  "reasoning": "Engineering has completed 23 similar tasks with avg score 8.4"
}
```

---

## Cycle Endpoints

### GET /api/cycles
List recent cycles.

**Query params:**
- `limit` (default: 20)

**Response:** 200
```json
{
  "cycles": [
    {
      "id": 1234,
      "planned_at": "2026-03-03T23:30:00Z",
      "status": "completed",
      "tasks_completed": 5,
      "tasks_failed": 1,
      "avg_score": 8.2
    }
  ]
}
```

### GET /api/cycles/:id
Get cycle details.

**Response:** 200
```json
{
  "cycle": {
    "id": 1234,
    "status": "completed",
    "plan_reasoning": "Focusing on stability...",
    "accomplished": [...],
    "failed": [...],
    "review_summary": "..."
  }
}
```

### POST /api/cycles/plan
Manually trigger cycle planning.

**Response:** 200
```json
{
  "success": true,
  "cycle_id": 1234,
  "tasks_created": 5
}
```

---

## Settings Endpoints

### GET /api/settings
Get company settings.

**Response:** 200
```json
{
  "settings": {
    "cycles_enabled": true,
    "cycle_frequency": "daily",
    "cycle_time": "23:30",
    "timezone": "America/Los_Angeles"
  }
}
```

### PUT /api/settings
Update settings.

**Request:**
```json
{
  "cycles_enabled": false,
  "cycle_frequency": "weekdays"
}
```

**Response:** 200
```json
{
  "success": true,
  "settings": {...}
}
```

---

## Skills & Learnings Endpoints

### GET /api/skills/search
Search skills.

**Query params:**
- `q` - Search query
- `limit` (default: 5)

**Response:** 200
```json
{
  "skills": [
    {
      "skill_name": "deploy-to-render",
      "summary": "Deploy Express apps to Render",
      "usage_count": 247
    }
  ]
}
```

### GET /api/skills/:name
Get skill content.

**Response:** 200
```json
{
  "skill": {
    "skill_name": "deploy-to-render",
    "summary": "...",
    "content": "## When to Use\n\n...",
    "usage_count": 247
  }
}
```

### GET /api/learnings
List learnings.

**Query params:**
- `category` - technical, process, business, etc.
- `tags` - Comma-separated
- `limit` (default: 20)

**Response:** 200
```json
{
  "learnings": [
    {
      "id": 801,
      "title": "JWT expiration best practices",
      "category": "technical",
      "confidence": 0.87,
      "created_at": "2026-03-04T02:00:00Z"
    }
  ]
}
```

---

## Subscription Endpoints

### GET /api/subscription
Get current subscription.

**Response:** 200
```json
{
  "subscription": {
    "plan": "base",
    "status": "active",
    "extra_companies": 0,
    "extra_task_packs": 1,
    "instant_tasks_remaining": 45,
    "current_period_end": "2026-04-01T00:00:00Z"
  }
}
```

### POST /api/subscription/upgrade
Upgrade subscription.

**Request:**
```json
{
  "extra_companies": 2,
  "extra_task_packs": 1
}
```

**Response:** 200
```json
{
  "success": true,
  "new_monthly_cost": 87
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

**Common error codes:**
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `VALIDATION_ERROR` - 400
- `RATE_LIMIT_EXCEEDED` - 429
- `INTERNAL_ERROR` - 500

---

## Rate Limiting

**Per company:**
- API calls: 1000/hour
- Email sends (cold): 2/day
- Task creations: 100/day

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1709539200
```

**429 response:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 3600
}
```
