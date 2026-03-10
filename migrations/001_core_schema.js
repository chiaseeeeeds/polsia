module.exports = {
  name: 'core_schema',
  up: async (client) => {
    // Companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        industry VARCHAR(100),
        size VARCHAR(50),
        owner_id INTEGER REFERENCES users(id),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add company_id to users
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)
    `);

    // Agents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        system_prompt TEXT,
        status VARCHAR(30) DEFAULT 'idle',
        enabled BOOLEAN DEFAULT true,
        config JSONB DEFAULT '{}',
        icon VARCHAR(10) DEFAULT '🤖',
        color VARCHAR(20) DEFAULT '#00e599',
        capabilities TEXT[],
        last_run_at TIMESTAMPTZ,
        total_executions INTEGER DEFAULT 0,
        successful_executions INTEGER DEFAULT 0,
        failed_executions INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Tasks table (job queue)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50),
        status VARCHAR(30) DEFAULT 'queued',
        priority INTEGER DEFAULT 5,
        input JSONB DEFAULT '{}',
        output JSONB,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        timeout_ms INTEGER DEFAULT 300000,
        scheduled_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Executions table (detailed execution logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS executions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'running',
        steps JSONB DEFAULT '[]',
        tool_calls JSONB DEFAULT '[]',
        tokens_used INTEGER DEFAULT 0,
        cost_cents INTEGER DEFAULT 0,
        duration_ms INTEGER,
        result JSONB,
        error TEXT,
        logs TEXT[] DEFAULT ARRAY[]::TEXT[],
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Agent tools table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_tools (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        schema JSONB NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Activity feed
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        task_id INTEGER REFERENCES tasks(id),
        execution_id INTEGER REFERENCES executions(id),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Sessions table for auth
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data JSONB DEFAULT '{}',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // API keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        prefix VARCHAR(20) NOT NULL,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_company ON agents(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at ASC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_executions_agent ON executions(agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_feed(company_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
  }
};
