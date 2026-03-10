module.exports = {
  name: 'chat_and_memory',
  up: async (client) => {
    // Conversations table (chat history)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        title VARCHAR(255) DEFAULT 'New conversation',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Messages table (individual chat messages)
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        agent_id INTEGER REFERENCES agents(id),
        tool_calls JSONB DEFAULT '[]',
        tool_results JSONB DEFAULT '[]',
        tokens_used INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Documents table (company knowledge base)
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        metadata JSONB DEFAULT '{}',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Memory tables (3-layer system)

    // Layer 1: Domain knowledge (facts about the company)
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_domain (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        source VARCHAR(50),
        confidence FLOAT DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Layer 2: Preferences (how the company likes things done)
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_preferences (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        context TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, key)
      )
    `);

    // Layer 3: Patterns (learned behaviors that work)
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_patterns (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        pattern_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Recurring tasks table (autonomous scheduling)
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_tasks (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        frequency VARCHAR(20) NOT NULL,
        days INTEGER[],
        day_of_month INTEGER,
        time_of_day TIME DEFAULT '00:00:00',
        is_active BOOLEAN DEFAULT true,
        last_run TIMESTAMPTZ,
        next_run TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Workflows table (multi-agent pipelines)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_config JSONB DEFAULT '{}',
        steps JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Workflow runs table (execution tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'running',
        current_step INTEGER DEFAULT 0,
        step_results JSONB DEFAULT '[]',
        error TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_company ON conversations(company_id, updated_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id, type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_domain_company ON memory_domain(company_id, category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_preferences_company ON memory_preferences(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_patterns_company ON memory_patterns(company_id, pattern_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recurring_tasks_company ON recurring_tasks(company_id, is_active, next_run)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_workflows_company ON workflows(company_id, is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id, started_at DESC)`);
  }
};
