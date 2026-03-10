# Agent Factory

Custom agent creation system. Users can create specialized agents beyond the 8 platform agents.

---

## Overview

**Platform provides 8 core agents** - Engineering, Research, Browser, Data, Support, Twitter, Cold Outreach, Meta Ads.

**Agent Factory lets users create custom agents** for specialized needs:
- Designer agent (Figma, design reviews)
- QA agent (testing, bug reports)
- Content agent (blog posts, documentation)
- Sales agent (CRM management, follow-ups)

---

## MCP Tools

### 1. list_mcp_tools

**List all available MCP servers and their tools**

```javascript
await mcpClient.callTool('agent_factory', 'list_mcp_tools');
```

**Returns:**
```javascript
{
  success: true,
  servers: [
    {
      name: "tasks",
      description: "Task queue management",
      tools: [
        {
          name: "create_task_proposal",
          description: "Create new task",
          parameters: [...]
        }
      ]
    }
  ]
}
```

### 2. get_mcp_tool_details

**Get detailed info about specific MCP server**

```javascript
await mcpClient.callTool('agent_factory', 'get_mcp_tool_details', {
  server_name: "polsia_infra"
});
```

### 3. create_agent

**Create custom agent**

```javascript
await mcpClient.callTool('agent_factory', 'create_agent', {
  name: "Designer",
  system_prompt: "You are the Design specialist for {{company_name}}. You review designs, create mockups, and ensure brand consistency.",
  mcp_servers: ["tasks", "reports", "documents"],
  model: "gpt-4",
  max_turns: 100,
  temperature: 0.7
});
```

**Parameters:**
- `name` (required) - Agent name
- `system_prompt` (required) - Prompt with {{company_name}} and {{current_date}} variables
- `mcp_servers` (required) - Array of MCP server names
- `model` (optional) - gpt-4, gpt-4-turbo, claude-sonnet (default: gpt-4)
- `max_turns` (optional) - Default: 100
- `temperature` (optional) - 0.0 to 1.0 (default: 0.7)

**Returns:**
```javascript
{
  success: true,
  agent_id: 55,
  agent: {
    id: 55,
    name: "Designer",
    type: "custom",
    is_active: true
  }
}
```

### 4. list_created_agents

**List user's custom agents**

```javascript
await mcpClient.callTool('agent_factory', 'list_created_agents');
```

**Returns:**
```javascript
{
  success: true,
  agents: [
    {
      id: 55,
      name: "Designer",
      type: "custom",
      tasks_completed: 12,
      avg_score: 8.1,
      created_at: "2026-03-01T10:00:00Z"
    }
  ]
}
```

### 5. get_agent_template

**Get template for common agent types**

```javascript
await mcpClient.callTool('agent_factory', 'get_agent_template', {
  template_type: "designer"
});
```

**Available templates:**
- designer
- qa
- content
- sales
- devops

**Returns template with pre-filled prompt and tools.**

---

## UI: Agent Factory Page

**Location:** `/dashboard/agent-factory`

### Step 1: Choose Template or Custom

```
┌────────────────────────────────────────────┐
│  Create Custom Agent                       │
├────────────────────────────────────────────┤
│  Start from template or build from scratch │
│                                            │
│  [📐 Designer]  [🧪 QA Tester]            │
│  [✍️ Content]    [💼 Sales]                │
│                                            │
│  [🔧 Build from scratch]                   │
└────────────────────────────────────────────┘
```

### Step 2: Configure Agent

```
┌────────────────────────────────────────────┐
│  Agent Configuration                       │
├────────────────────────────────────────────┤
│  Name: [Designer____________]              │
│                                            │
│  System Prompt:                            │
│  [You are the Design specialist...]        │
│                                            │
│  Model: [gpt-4 ▾]                          │
│  Temperature: [0.7]                        │
│  Max Turns: [100]                          │
│                                            │
│  Tools Access:                             │
│  ☑ tasks      ☑ reports                   │
│  ☑ documents  ☐ polsia_infra              │
│  ☐ email      ☐ browser                   │
│                                            │
│  [Create Agent]                            │
└────────────────────────────────────────────┘
```

### Step 3: Test Agent

```
┌────────────────────────────────────────────┐
│  Test Your Agent                           │
├────────────────────────────────────────────┤
│  Send a test message to Designer:          │
│                                            │
│  [Review the homepage design___________]   │
│  [Send Test]                               │
│                                            │
│  Response:                                 │
│  "Analyzing homepage... The hero section   │
│   is strong but CTA button needs more      │
│   contrast. Recommend changing..."         │
│                                            │
│  [Looks good, activate agent]              │
└────────────────────────────────────────────┘
```

---

## Agent Templates

### Designer Template

```javascript
{
  name: "Designer",
  system_prompt: `
You are the Design specialist for {{company_name}}.

## Your Role
Review designs, create mockups, ensure brand consistency.

## Skills
- UI/UX review
- Brand guidelines
- Design feedback
- Mockup creation

## Rules
- Reference brand_voice document
- Provide actionable feedback
- Suggest specific improvements
- Consider accessibility

Current date: {{current_date}}
  `,
  mcp_servers: ["tasks", "reports", "documents"],
  model: "gpt-4",
  max_turns: 100
}
```

### QA Template

```javascript
{
  name: "QA Tester",
  system_prompt: `
You are the QA specialist for {{company_name}}.

## Your Role
Test features, find bugs, ensure quality.

## Skills
- Manual testing
- Bug reproduction
- Test case creation
- Regression testing

## Rules
- Document reproduction steps
- Include screenshots/logs
- Classify severity (critical/high/medium/low)
- Suggest fixes when obvious

Current date: {{current_date}}
  `,
  mcp_servers: ["tasks", "reports", "polsia_infra"],
  model: "gpt-4",
  max_turns: 100
}
```

### Content Template

```javascript
{
  name: "Content Writer",
  system_prompt: `
You are the Content specialist for {{company_name}}.

## Your Role
Write blog posts, documentation, marketing copy.

## Skills
- Blog post writing
- Technical documentation
- Marketing copy
- SEO optimization

## Rules
- Reference brand_voice document
- Match company tone
- Include SEO keywords
- Cite sources

Current date: {{current_date}}
  `,
  mcp_servers: ["tasks", "reports", "documents"],
  model: "gpt-4",
  max_turns: 150
}
```

---

## Database Schema

**Uses existing `agents` table:**

```sql
-- Custom agents have type='custom' and company_id set
SELECT * FROM agents WHERE type='custom' AND company_id = $1;
```

**Tool mappings:**

```sql
-- agent_tools table links agents to MCP servers
SELECT mcp_server FROM agent_tools WHERE agent_id = $1;
```

---

## API Endpoints

### GET /api/agent-factory/tools
List available MCP tools.

**Response:**
```json
{
  "servers": [
    {
      "name": "tasks",
      "description": "Task management",
      "tools": [...]
    }
  ]
}
```

### GET /api/agent-factory/templates
Get agent templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "designer",
      "name": "Designer",
      "description": "UI/UX design review",
      "system_prompt": "...",
      "mcp_servers": ["tasks", "reports", "documents"]
    }
  ]
}
```

### POST /api/agents
Create custom agent.

**Request:**
```json
{
  "name": "Designer",
  "system_prompt": "...",
  "mcp_servers": ["tasks", "reports"],
  "model": "gpt-4"
}
```

**Response:** 201
```json
{
  "success": true,
  "agent_id": 55
}
```

### POST /api/agents/:id/test
Test agent with sample message.

**Request:**
```json
{
  "message": "Review the homepage design"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Analyzing homepage... The hero section is strong..."
}
```

---

## Limitations

**V1 constraints:**
- Max 3 custom agents per company (prevents abuse)
- Cannot modify platform agents (8 core agents are read-only)
- Cannot delete agents with completed tasks (data integrity)
- Custom agents share same task queue (no priority)

---

## Best Practices

### System Prompt Guidelines

**DO:**
- Start with "You are the [Role] specialist for {{company_name}}"
- Define role clearly
- List specific skills
- Set behavioral rules
- Include template variables

**DON'T:**
- Make prompts too long (>1000 words)
- Include company-specific details (use documents)
- Give conflicting instructions
- Forget {{current_date}} variable

### Tool Selection

**DO:**
- Grant minimum necessary tools
- Always include `tasks` (agents need to create tasks)
- Include `reports` for deliverables
- Include `documents` to reference company context

**DON'T:**
- Grant all tools by default
- Give `polsia_infra` unless agent needs deploy access
- Give `email` unless agent handles outreach
- Give `meta_ads` unless agent manages ads

---

## Future Enhancements

(Not in V1)

- Agent marketplace (share/sell custom agents)
- Agent cloning (duplicate + modify existing)
- Agent versioning (rollback changes)
- Agent analytics (detailed performance metrics)
- Agent collaboration (agents work together on tasks)
- Agent personalities (customize tone/style)
- Multi-agent workflows (chain agents automatically)
