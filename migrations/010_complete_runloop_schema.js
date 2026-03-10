/**
 * Complete Runloop Database Schema
 *
 * Creates all tables for the Runloop platform based on docs/DATABASE_SCHEMA.md
 * This is idempotent - safe to run multiple times.
 */

module.exports = {
  async up(client) {
    console.log('🔄 Running complete schema migration - will drop and recreate tables');

    // Enable pgvector extension for embeddings
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // ============================================================================
    // DROP EXISTING TABLES (in reverse dependency order)
    // ============================================================================

    const tablesToDrop = [
      'referrals', 'subscriptions', 'agent_metrics', 'dashboard_links',
      'site_credentials', 'contacts', 'email_messages', 'reports', 'learnings',
      'skills', 'workflow_runs', 'workflows', 'recurring_tasks', 'documents',
      'memory_layer3', 'memory_layer2', 'memory_layer1',
      'memory_patterns', 'memory_preferences', 'memory_domain',
      'executions', 'tasks', 'messages', 'conversations',
      'agent_tools', 'agents', 'activity_feed', 'api_keys',
      'cycles', 'sessions', 'companies', 'users'
    ];

    for (const table of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

    console.log('✅ Dropped existing tables');

    // ============================================================================
    // CORE TABLES
    // ============================================================================

    // Users table
    await client.query(`
      CREATE TABLE users (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE INDEX idx_users_email ON users(email);
    `);

    // Companies table
    await client.query(`
      CREATE TABLE companies (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        website TEXT,
        industry TEXT,

        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        portfolio_type TEXT CHECK (portfolio_type IN ('owned', 'polsia_fund')),

        cycles_completed INT DEFAULT 0,
        tasks_completed INT DEFAULT 0,

        timezone TEXT DEFAULT 'America/Los_Angeles',
        cycle_frequency TEXT DEFAULT 'daily' CHECK (cycle_frequency IN ('daily', 'weekdays', 'weekly')),
        cycle_time TEXT DEFAULT '23:30',
        cycles_enabled BOOLEAN DEFAULT true,

        onboarding_completed BOOLEAN DEFAULT false,
        onboarding_step INT DEFAULT 0,
        onboarding_data JSONB DEFAULT '{}',

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_companies_owner ON companies(owner_id);
      CREATE INDEX idx_companies_slug ON companies(slug);
      CREATE INDEX idx_companies_status ON companies(status);
    `);

    // ============================================================================
    // AGENT TABLES
    // ============================================================================

    // Agents table
    await client.query(`
      CREATE TABLE agents (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,

        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('execution', 'meta_ads', 'custom')),

        system_prompt TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'gpt-4',
        max_turns INT DEFAULT 100,
        temperature FLOAT DEFAULT 0.7,

        is_active BOOLEAN DEFAULT true,
        is_platform_agent BOOLEAN DEFAULT false,

        tasks_completed INT DEFAULT 0,
        tasks_failed INT DEFAULT 0,
        avg_score FLOAT,
        last_run_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(company_id, slug)
      );
    `);

    await client.query(`
      CREATE INDEX idx_agents_company ON agents(company_id);
      CREATE INDEX idx_agents_type ON agents(type);
      CREATE INDEX idx_agents_platform ON agents(is_platform_agent);
    `);

    // Agent tools (MCP server mappings)
    await client.query(`
      CREATE TABLE agent_tools (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        mcp_server TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_agent_tools_agent ON agent_tools(agent_id);
      CREATE UNIQUE INDEX idx_agent_tools_unique ON agent_tools(agent_id, mcp_server);
    `);

    // ============================================================================
    // CONVERSATION TABLES
    // ============================================================================

    // Conversations table
    await client.query(`
      CREATE TABLE conversations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        title TEXT,
        message_count INT DEFAULT 0,
        last_message_at TIMESTAMPTZ,
        last_memory_save_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_conversations_company ON conversations(company_id);
      CREATE INDEX idx_conversations_user ON conversations(user_id);
    `);

    // Messages table
    await client.query(`
      CREATE TABLE messages (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,

        agent_id BIGINT REFERENCES agents(id),
        agent_name TEXT,
        source TEXT,

        tool_calls JSONB,
        metadata JSONB DEFAULT '{}',
        token_count INT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX idx_messages_created ON messages(created_at);
      CREATE INDEX idx_messages_agent ON messages(agent_id);
    `);

    // ============================================================================
    // TASK TABLES
    // ============================================================================

    // Tasks table
    await client.query(`
      CREATE TABLE tasks (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        description TEXT NOT NULL,
        suggestion_reasoning TEXT NOT NULL,

        tag TEXT NOT NULL CHECK (tag IN ('engineering', 'research', 'browser', 'growth', 'content', 'data', 'support', 'meta_ads')),
        task_type TEXT NOT NULL,
        task_category TEXT NOT NULL CHECK (task_category IN ('engineering', 'research', 'growth', 'content', 'support', 'data', 'ops')),

        suggested_agent_id BIGINT REFERENCES agents(id),
        assigned_agent_id BIGINT REFERENCES agents(id),

        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        complexity INT NOT NULL CHECK (complexity BETWEEN 1 AND 10),
        estimated_hours FLOAT NOT NULL CHECK (estimated_hours <= 4),
        queue_position INT,

        status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'todo', 'in_progress', 'blocked', 'waiting', 'completed', 'failed', 'rejected')),
        executability_type TEXT NOT NULL CHECK (executability_type IN ('can_run_now', 'needs_new_connection', 'manual_task')),
        execution_id BIGINT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        completion_summary TEXT,
        failure_reason TEXT,

        source TEXT CHECK (source IN ('owner_request', 'agent_generated', 'monitoring', 'bug', 'cycle')),
        related_task_ids BIGINT[],
        metadata JSONB DEFAULT '{}',

        score INT CHECK (score BETWEEN 1 AND 10),
        score_comment TEXT,
        scored_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_tasks_company_status ON tasks(company_id, status);
      CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
      CREATE INDEX idx_tasks_queue ON tasks(company_id, status, queue_position) WHERE status = 'todo';
      CREATE INDEX idx_tasks_priority ON tasks(priority);
      CREATE INDEX idx_tasks_created ON tasks(created_at);
    `);

    // Executions table
    await client.query(`
      CREATE TABLE executions (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id BIGINT NOT NULL REFERENCES agents(id),
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),

        thinking TEXT,
        logs JSONB DEFAULT '[]',
        tool_calls JSONB DEFAULT '[]',

        duration_seconds INT,
        tokens_used INT,

        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE INDEX idx_executions_task ON executions(task_id);
      CREATE INDEX idx_executions_agent ON executions(agent_id);
      CREATE INDEX idx_executions_company ON executions(company_id);
    `);

    // ============================================================================
    // MEMORY TABLES
    // ============================================================================

    // Memory Layer 1 (Domain Knowledge)
    await client.query(`
      CREATE TABLE memory_layer1 (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),

        accessed_count INT DEFAULT 0,
        last_accessed_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_layer1_company ON memory_layer1(company_id);
    `);

    // Memory Layer 2 (Preferences)
    await client.query(`
      CREATE TABLE memory_layer2 (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_layer2_company ON memory_layer2(company_id);
    `);

    // Memory Layer 3 (Cross-Company Patterns)
    await client.query(`
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
    `);

    await client.query(`
      CREATE INDEX idx_layer3_category ON memory_layer3(category);
      CREATE INDEX idx_layer3_confidence ON memory_layer3(confidence);
    `);

    // ============================================================================
    // DOCUMENT TABLES
    // ============================================================================

    // Documents table
    await client.query(`
      CREATE TABLE documents (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        type TEXT NOT NULL CHECK (type IN ('mission', 'product_overview', 'tech_notes', 'brand_voice', 'user_research')),
        content TEXT NOT NULL,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(company_id, type)
      );
    `);

    await client.query(`
      CREATE INDEX idx_documents_company ON documents(company_id);
    `);

    // ============================================================================
    // WORKFLOW & AUTOMATION TABLES
    // ============================================================================

    // Recurring tasks
    await client.query(`
      CREATE TABLE recurring_tasks (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        template JSONB NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekly', 'monthly')),

        enabled BOOLEAN DEFAULT true,
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_recurring_company ON recurring_tasks(company_id);
      CREATE INDEX idx_recurring_next_run ON recurring_tasks(next_run_at) WHERE enabled = true;
    `);

    // Workflows
    await client.query(`
      CREATE TABLE workflows (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'webhook', 'task_complete')),
        steps JSONB NOT NULL,

        enabled BOOLEAN DEFAULT true,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_workflows_company ON workflows(company_id);
    `);

    // Workflow runs
    await client.query(`
      CREATE TABLE workflow_runs (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
        current_step INT DEFAULT 0,

        tasks_created BIGINT[],
        logs JSONB DEFAULT '[]',

        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
      CREATE INDEX idx_workflow_runs_company ON workflow_runs(company_id);
    `);

    // ============================================================================
    // SKILLS & LEARNING TABLES
    // ============================================================================

    // Skills table
    await client.query(`
      CREATE TABLE skills (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

        skill_name TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT[] NOT NULL,

        agent_types TEXT[],
        usage_count INT DEFAULT 0,
        created_by_model TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_skills_keywords ON skills USING GIN(keywords);
      CREATE INDEX idx_skills_name ON skills(skill_name);
    `);

    // Learnings table
    await client.query(`
      CREATE TABLE learnings (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('technical', 'process', 'business', 'user_behavior', 'infrastructure', 'debugging')),

        tags TEXT[],
        confidence FLOAT DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),

        created_by_agent_id BIGINT REFERENCES agents(id),
        embedding vector(1536),

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_learnings_company ON learnings(company_id);
      CREATE INDEX idx_learnings_category ON learnings(category);
      CREATE INDEX idx_learnings_tags ON learnings USING GIN(tags);
    `);

    // ============================================================================
    // REPORTING TABLES
    // ============================================================================

    // Reports table
    await client.query(`
      CREATE TABLE reports (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        content TEXT NOT NULL,
        report_type TEXT,

        tags TEXT[],
        metadata JSONB DEFAULT '{}',

        created_by_agent_id BIGINT REFERENCES agents(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_reports_company ON reports(company_id);
      CREATE INDEX idx_reports_type ON reports(report_type);
      CREATE INDEX idx_reports_created ON reports(created_at);
      CREATE INDEX idx_reports_tags ON reports USING GIN(tags);
    `);

    // ============================================================================
    // EMAIL & CRM TABLES
    // ============================================================================

    // Email messages
    await client.query(`
      CREATE TABLE email_messages (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        from_email TEXT NOT NULL,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,

        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        is_transactional BOOLEAN DEFAULT false,

        thread_id TEXT,
        in_reply_to TEXT,

        sent_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ,
        read_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_email_company ON email_messages(company_id);
      CREATE INDEX idx_email_direction ON email_messages(direction);
      CREATE INDEX idx_email_thread ON email_messages(thread_id);
    `);

    // Contacts (CRM)
    await client.query(`
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
    `);

    await client.query(`
      CREATE INDEX idx_contacts_company ON contacts(company_id);
      CREATE INDEX idx_contacts_status ON contacts(status);
      CREATE INDEX idx_contacts_email ON contacts(email);
    `);

    // ============================================================================
    // BROWSER AUTH TABLES
    // ============================================================================

    // Site credentials
    await client.query(`
      CREATE TABLE site_credentials (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        site TEXT NOT NULL,
        username TEXT NOT NULL,
        password_encrypted TEXT NOT NULL,

        notes TEXT,
        last_used_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(company_id, site)
      );
    `);

    await client.query(`
      CREATE INDEX idx_credentials_company ON site_credentials(company_id);
    `);

    // ============================================================================
    // DASHBOARD TABLES
    // ============================================================================

    // Dashboard links
    await client.query(`
      CREATE TABLE dashboard_links (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,

        created_by_agent_id BIGINT REFERENCES agents(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_links_company ON dashboard_links(company_id);
    `);

    // Agent metrics
    await client.query(`
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
    `);

    await client.query(`
      CREATE INDEX idx_metrics_agent ON agent_metrics(agent_id);
      CREATE INDEX idx_metrics_date ON agent_metrics(date);
    `);

    // ============================================================================
    // SUBSCRIPTION & BILLING TABLES
    // ============================================================================

    // Subscriptions
    await client.query(`
      CREATE TABLE subscriptions (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

        plan TEXT NOT NULL DEFAULT 'base' CHECK (plan IN ('base', 'pro', 'enterprise')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'cancelled', 'past_due', 'suspended', 'expired')),

        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,

        extra_companies INT DEFAULT 0,
        extra_task_packs INT DEFAULT 0,

        instant_tasks_remaining INT DEFAULT 15,
        instant_tasks_used INT DEFAULT 0,

        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        trial_end TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
      CREATE INDEX idx_subscriptions_status ON subscriptions(status);
    `);

    // Referrals
    await client.query(`
      CREATE TABLE referrals (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        referrer_user_id BIGINT NOT NULL REFERENCES users(id),
        referred_user_id BIGINT REFERENCES users(id),

        referral_code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'paid')),

        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE INDEX idx_referrals_code ON referrals(referral_code);
      CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
    `);

    // ============================================================================
    // CYCLE TABLES
    // ============================================================================

    // Cycles
    await client.query(`
      CREATE TABLE cycles (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        planned_at TIMESTAMPTZ NOT NULL,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'executing', 'completed', 'failed')),

        plan_reasoning TEXT,
        planned_tasks JSONB,

        tasks_created INT DEFAULT 0,
        tasks_completed INT DEFAULT 0,
        tasks_failed INT DEFAULT 0,
        tasks_blocked INT DEFAULT 0,

        review_summary TEXT,
        accomplished JSONB,
        failed JSONB,
        blocked JSONB,
        tomorrow_priorities JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX idx_cycles_company ON cycles(company_id);
      CREATE INDEX idx_cycles_status ON cycles(status);
      CREATE INDEX idx_cycles_planned ON cycles(planned_at);
    `);

    console.log('✅ All tables created successfully');
  },

  async down(client) {
    // Drop all tables in reverse order (respecting foreign keys)
    const tables = [
      'cycles',
      'referrals',
      'subscriptions',
      'agent_metrics',
      'dashboard_links',
      'site_credentials',
      'contacts',
      'email_messages',
      'reports',
      'learnings',
      'skills',
      'workflow_runs',
      'workflows',
      'recurring_tasks',
      'documents',
      'memory_layer3',
      'memory_layer2',
      'memory_layer1',
      'executions',
      'tasks',
      'messages',
      'conversations',
      'agent_tools',
      'agents',
      'companies',
      'users'
    ];

    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

    console.log('✅ All tables dropped');
  }
};
