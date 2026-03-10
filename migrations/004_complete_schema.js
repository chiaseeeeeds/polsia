module.exports = {
  name: 'complete_schema',
  up: async (client) => {
    // Reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        report_type VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        content JSONB,
        created_by_agent_id INTEGER REFERENCES agents(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Email messages table (company inbox)
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_messages (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        direction VARCHAR(20) NOT NULL,
        from_email VARCHAR(255),
        to_email VARCHAR(255),
        subject TEXT,
        body TEXT,
        thread_id VARCHAR(255),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Contacts table (CRM)
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        company_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        last_action TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Site credentials table (browser automation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_credentials (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        site_domain VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        password TEXT,
        tier INTEGER DEFAULT 3,
        context_data JSONB DEFAULT '{}',
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Dashboard links table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard_links (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Agent metrics table (daily stats)
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        tasks_completed INTEGER DEFAULT 0,
        tasks_failed INTEGER DEFAULT 0,
        avg_duration_ms INTEGER,
        tokens_used INTEGER DEFAULT 0,
        UNIQUE(agent_id, date)
      )
    `);

    // Subscriptions table (billing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'trialing',
        plan_tier VARCHAR(50) DEFAULT 'standard',
        task_credits_remaining INTEGER DEFAULT 5,
        task_credits_monthly INTEGER DEFAULT 5,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ends_at TIMESTAMPTZ
      )
    `);

    // Cycles table (nightly planning)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cycles (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        cycle_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        plan JSONB,
        review JSONB,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);

    // Skills table (reusable procedures)
    await client.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        skill_name VARCHAR(255) UNIQUE NOT NULL,
        summary TEXT,
        content TEXT NOT NULL,
        keywords TEXT[],
        agent_types TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Learnings table (knowledge accumulation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS learnings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        content TEXT NOT NULL,
        tags TEXT[],
        source VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_messages_company ON email_messages(company_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_site_credentials_company ON site_credentials(company_id, site_domain)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dashboard_links_company ON dashboard_links(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id, date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cycles_company ON cycles(company_id, cycle_date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(skill_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_company ON skills(company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_learnings_company ON learnings(company_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_learnings_tags ON learnings USING GIN(tags)`);

    // Full-text search indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_content_search ON skills USING GIN(to_tsvector('english', content || ' ' || COALESCE(summary, '') || ' ' || skill_name))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_learnings_content_search ON learnings USING GIN(to_tsvector('english', content))`);
  }
};
