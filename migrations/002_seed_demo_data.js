module.exports = {
  name: 'seed_demo_data',
  up: async (client) => {
    // Check if demo data already exists
    const existing = await client.query(`SELECT id FROM companies WHERE name = 'Demo Company' LIMIT 1`);
    if (existing.rows.length > 0) return;

    // Create demo company
    const companyRes = await client.query(`
      INSERT INTO companies (name, description, industry, size)
      VALUES ('Demo Company', 'An autonomous AI-powered company', 'Technology', '1-10')
      RETURNING id
    `);
    const companyId = companyRes.rows[0].id;

    // Define 6 agents
    const agents = [
      {
        name: 'Engineering Agent', type: 'engineering', icon: '⚡',
        color: '#00e599',
        description: 'Writes code, fixes bugs, deploys to production. Handles all technical implementation.',
        system_prompt: 'You are an expert software engineer. Write clean, production-ready code. Use best practices, add error handling, and write tests.',
        capabilities: ['code_execute', 'file_read', 'file_write', 'git_operations', 'terminal']
      },
      {
        name: 'Research Agent', type: 'research', icon: '🔍',
        color: '#6366f1',
        description: 'Conducts deep research, analyzes competitors, synthesizes findings into actionable reports.',
        system_prompt: 'You are a thorough research analyst. Find accurate information, verify facts, and present findings clearly with citations.',
        capabilities: ['web_search', 'web_scrape', 'summarize', 'report_generate']
      },
      {
        name: 'Growth Agent', type: 'growth', icon: '📈',
        color: '#f59e0b',
        description: 'Drives user acquisition through content, campaigns, and audience analysis.',
        system_prompt: 'You are a growth marketing expert. Create compelling content, design campaigns, and analyze audience data to drive acquisition.',
        capabilities: ['email_send', 'content_generate', 'social_post', 'audience_analyze']
      },
      {
        name: 'Sales Agent', type: 'sales', icon: '🎯',
        color: '#ef4444',
        description: 'Finds leads, sends personalized outreach, and manages the sales pipeline.',
        system_prompt: 'You are an experienced sales professional. Research prospects, personalize outreach, and follow up persistently but respectfully.',
        capabilities: ['lead_search', 'email_send', 'crm_update', 'template_generate']
      },
      {
        name: 'Operations Agent', type: 'operations', icon: '🔧',
        color: '#8b5cf6',
        description: 'Monitors services, manages schedules, and keeps everything running smoothly.',
        system_prompt: 'You are a meticulous operations manager. Monitor systems, schedule tasks, send alerts, and maintain data integrity.',
        capabilities: ['schedule_task', 'monitor_service', 'alert_send', 'data_sync']
      },
      {
        name: 'Support Agent', type: 'support', icon: '💬',
        color: '#06b6d4',
        description: 'Responds to tickets, searches knowledge bases, and escalates when needed.',
        system_prompt: 'You are a helpful support agent. Respond empathetically, solve issues quickly, and escalate complex problems.',
        capabilities: ['ticket_respond', 'knowledge_search', 'escalate', 'sentiment_analyze']
      }
    ];

    const agentIds = [];
    for (const a of agents) {
      const res = await client.query(`
        INSERT INTO agents (company_id, name, type, description, system_prompt, icon, color, capabilities, status, total_executions, successful_executions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [companyId, a.name, a.type, a.description, a.system_prompt, a.icon, a.color, a.capabilities, 'idle',
          Math.floor(Math.random() * 40) + 10, Math.floor(Math.random() * 35) + 8]);
      agentIds.push({ id: res.rows[0].id, ...a });
    }

    // Define tools for each agent
    const toolDefs = {
      engineering: [
        { name: 'code_execute', description: 'Execute code in a sandboxed environment', schema: { type: 'function', parameters: { type: 'object', properties: { language: { type: 'string' }, code: { type: 'string' } }, required: ['language', 'code'] }} },
        { name: 'file_read', description: 'Read file contents from repository', schema: { type: 'function', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }} },
        { name: 'file_write', description: 'Write content to a file', schema: { type: 'function', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }} },
        { name: 'git_operations', description: 'Execute git commands', schema: { type: 'function', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }} },
        { name: 'terminal', description: 'Run terminal commands', schema: { type: 'function', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }} }
      ],
      research: [
        { name: 'web_search', description: 'Search the web for information', schema: { type: 'function', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }} },
        { name: 'web_scrape', description: 'Scrape content from a URL', schema: { type: 'function', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }} },
        { name: 'summarize', description: 'Summarize text content', schema: { type: 'function', parameters: { type: 'object', properties: { text: { type: 'string' }, max_length: { type: 'integer' } }, required: ['text'] }} },
        { name: 'report_generate', description: 'Generate a structured report', schema: { type: 'function', parameters: { type: 'object', properties: { title: { type: 'string' }, sections: { type: 'array' } }, required: ['title'] }} }
      ],
      growth: [
        { name: 'content_generate', description: 'Generate marketing content', schema: { type: 'function', parameters: { type: 'object', properties: { type: { type: 'string' }, topic: { type: 'string' }, tone: { type: 'string' } }, required: ['type', 'topic'] }} },
        { name: 'social_post', description: 'Create social media posts', schema: { type: 'function', parameters: { type: 'object', properties: { platform: { type: 'string' }, content: { type: 'string' } }, required: ['platform', 'content'] }} },
        { name: 'audience_analyze', description: 'Analyze audience demographics and behavior', schema: { type: 'function', parameters: { type: 'object', properties: { segment: { type: 'string' } }, required: ['segment'] }} },
        { name: 'email_send', description: 'Send marketing emails', schema: { type: 'function', parameters: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] }} }
      ],
      sales: [
        { name: 'lead_search', description: 'Search for potential leads', schema: { type: 'function', parameters: { type: 'object', properties: { criteria: { type: 'string' } }, required: ['criteria'] }} },
        { name: 'crm_update', description: 'Update CRM records', schema: { type: 'function', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, data: { type: 'object' } }, required: ['lead_id', 'data'] }} },
        { name: 'template_generate', description: 'Generate email templates', schema: { type: 'function', parameters: { type: 'object', properties: { type: { type: 'string' }, context: { type: 'string' } }, required: ['type'] }} }
      ],
      operations: [
        { name: 'schedule_task', description: 'Schedule a recurring task', schema: { type: 'function', parameters: { type: 'object', properties: { name: { type: 'string' }, cron: { type: 'string' } }, required: ['name', 'cron'] }} },
        { name: 'monitor_service', description: 'Check service health', schema: { type: 'function', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }} },
        { name: 'alert_send', description: 'Send an alert notification', schema: { type: 'function', parameters: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' } }, required: ['channel', 'message'] }} },
        { name: 'data_sync', description: 'Sync data between services', schema: { type: 'function', parameters: { type: 'object', properties: { source: { type: 'string' }, target: { type: 'string' } }, required: ['source', 'target'] }} }
      ],
      support: [
        { name: 'ticket_respond', description: 'Respond to a support ticket', schema: { type: 'function', parameters: { type: 'object', properties: { ticket_id: { type: 'string' }, response: { type: 'string' } }, required: ['ticket_id', 'response'] }} },
        { name: 'knowledge_search', description: 'Search knowledge base', schema: { type: 'function', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }} },
        { name: 'escalate', description: 'Escalate issue to human', schema: { type: 'function', parameters: { type: 'object', properties: { ticket_id: { type: 'string' }, reason: { type: 'string' } }, required: ['ticket_id', 'reason'] }} },
        { name: 'sentiment_analyze', description: 'Analyze customer sentiment', schema: { type: 'function', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }} }
      ]
    };

    // Insert tools for each agent
    for (const agent of agentIds) {
      const tools = toolDefs[agent.type] || [];
      for (const tool of tools) {
        await client.query(`
          INSERT INTO agent_tools (agent_id, name, description, schema)
          VALUES ($1, $2, $3, $4)
        `, [agent.id, tool.name, tool.description, JSON.stringify(tool.schema)]);
      }
    }

    // Seed demo executions (2-3 per agent)
    const demoTasks = [
      // Engineering
      { agentType: 'engineering', title: 'Deploy authentication module', description: 'Implemented JWT-based auth with refresh tokens', status: 'completed', priority: 8 },
      { agentType: 'engineering', title: 'Fix memory leak in worker', description: 'Identified and patched event listener leak in queue processor', status: 'completed', priority: 9 },
      { agentType: 'engineering', title: 'Set up CI/CD pipeline', description: 'Configure automated testing and deployment pipeline', status: 'completed', priority: 7 },
      // Research
      { agentType: 'research', title: 'Competitive analysis: AI agent platforms', description: 'Deep dive into AutoGPT, CrewAI, and Langchain alternatives', status: 'completed', priority: 6 },
      { agentType: 'research', title: 'Market sizing for autonomous AI', description: 'TAM/SAM/SOM analysis for autonomous business AI market', status: 'completed', priority: 7 },
      // Growth
      { agentType: 'growth', title: 'Launch blog post: Future of AI Agents', description: 'Created and published thought leadership piece', status: 'completed', priority: 5 },
      { agentType: 'growth', title: 'Twitter thread on agent orchestration', description: 'Generated viral thread about multi-agent systems', status: 'completed', priority: 4 },
      { agentType: 'growth', title: 'Email nurture sequence v1', description: 'Built 5-email onboarding sequence for new signups', status: 'completed', priority: 6 },
      // Sales
      { agentType: 'sales', title: 'Prospect list: YC W24 companies', description: 'Identified 50 potential early adopters from recent YC batch', status: 'completed', priority: 7 },
      { agentType: 'sales', title: 'Cold outreach templates', description: 'Created 3 personalized outreach templates for different ICPs', status: 'completed', priority: 5 },
      // Operations
      { agentType: 'operations', title: 'Set up monitoring alerts', description: 'Configured uptime monitoring with 5-minute intervals', status: 'completed', priority: 8 },
      { agentType: 'operations', title: 'Database backup automation', description: 'Scheduled daily backups with 30-day retention', status: 'completed', priority: 9 },
      // Support
      { agentType: 'support', title: 'Create FAQ knowledge base', description: 'Built initial FAQ with 25 common questions and answers', status: 'completed', priority: 5 },
      { agentType: 'support', title: 'Auto-response templates', description: 'Set up intelligent auto-responses for common ticket types', status: 'completed', priority: 4 }
    ];

    for (const task of demoTasks) {
      const agent = agentIds.find(a => a.type === task.agentType);
      if (!agent) continue;

      const hoursAgo = Math.floor(Math.random() * 72) + 1;
      const durationMs = Math.floor(Math.random() * 45000) + 5000;
      const createdAt = new Date(Date.now() - hoursAgo * 3600000);
      const completedAt = new Date(createdAt.getTime() + durationMs);

      const taskRes = await client.query(`
        INSERT INTO tasks (company_id, agent_id, title, description, status, priority, started_at, completed_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [companyId, agent.id, task.title, task.description, task.status, task.priority, createdAt, completedAt, createdAt]);

      // Create execution for each task
      const steps = [
        { step: 'Analyzing task requirements', status: 'completed', duration_ms: Math.floor(durationMs * 0.1) },
        { step: 'Executing primary action', status: 'completed', duration_ms: Math.floor(durationMs * 0.6) },
        { step: 'Validating results', status: 'completed', duration_ms: Math.floor(durationMs * 0.2) },
        { step: 'Generating summary', status: 'completed', duration_ms: Math.floor(durationMs * 0.1) }
      ];

      const logEntries = [
        `[${createdAt.toISOString()}] Task started: ${task.title}`,
        `[${new Date(createdAt.getTime() + durationMs * 0.1).toISOString()}] Analyzing requirements...`,
        `[${new Date(createdAt.getTime() + durationMs * 0.3).toISOString()}] Executing primary action...`,
        `[${new Date(createdAt.getTime() + durationMs * 0.7).toISOString()}] Validating results...`,
        `[${completedAt.toISOString()}] Task completed successfully`
      ];

      await client.query(`
        INSERT INTO executions (task_id, agent_id, company_id, status, steps, tokens_used, duration_ms, logs, started_at, completed_at)
        VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8, $9)
      `, [taskRes.rows[0].id, agent.id, companyId, JSON.stringify(steps),
          Math.floor(Math.random() * 3000) + 500, durationMs, logEntries, createdAt, completedAt]);

      // Activity feed entry
      await client.query(`
        INSERT INTO activity_feed (company_id, agent_id, task_id, type, title, description, created_at)
        VALUES ($1, $2, $3, 'task_completed', $4, $5, $6)
      `, [companyId, agent.id, taskRes.rows[0].id, `${agent.name} completed: ${task.title}`, task.description, completedAt]);
    }
  }
};
