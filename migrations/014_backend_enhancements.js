/**
 * Backend Enhancements
 *
 * Adds columns needed for:
 * - Task retry logic (retry_count)
 * - Task scoring (score, score_reasoning)
 * - Email status tracking
 * - Contact lead management
 * - Cycle config on companies
 * - Dashboard links table
 */
module.exports = {
  name: '014_backend_enhancements',

  async up(client) {
    console.log('🔄 Running backend enhancements migration');

    // Task retry and scoring
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS score INTEGER;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS score_reasoning TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_summary TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS queue_position INTEGER;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Email message status
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
        ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
        ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS external_id TEXT;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Contact lead management
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
        ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Company cycle config
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS cycles_enabled BOOLEAN DEFAULT true;
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS cycle_time TEXT DEFAULT '02:00';
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS cycle_frequency TEXT DEFAULT 'daily';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Dashboard links
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard_links (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT DEFAULT '🔗',
        category TEXT DEFAULT 'general',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Execution steps column
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE executions ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]';
        ALTER TABLE executions ADD COLUMN IF NOT EXISTS logs TEXT[] DEFAULT '{}';
        ALTER TABLE executions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
        ALTER TABLE executions ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Agent stats columns
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS tasks_failed INTEGER DEFAULT 0;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_turns INTEGER DEFAULT 10;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4o';
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Recurring task enhancements
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS time_of_day TEXT;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS days INTEGER[];
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS agent_id BIGINT;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5;
        ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS description TEXT;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Recurring task runs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_task_runs (
        id BIGSERIAL PRIMARY KEY,
        recurring_task_id BIGINT NOT NULL,
        task_id BIGINT,
        status TEXT DEFAULT 'created',
        output TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Conversation enhancements
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_memory_save_at TIMESTAMPTZ;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Cycles enhancements
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE cycles ADD COLUMN IF NOT EXISTS tasks_created INTEGER DEFAULT 0;
        ALTER TABLE cycles ADD COLUMN IF NOT EXISTS accomplished JSONB;
        ALTER TABLE cycles ADD COLUMN IF NOT EXISTS failed JSONB;
        ALTER TABLE cycles ADD COLUMN IF NOT EXISTS blocked JSONB;
        ALTER TABLE cycles ADD COLUMN IF NOT EXISTS tomorrow_priorities JSONB;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Site credentials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_credentials (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL,
        site_domain TEXT NOT NULL,
        username TEXT,
        password TEXT,
        tier INTEGER DEFAULT 3,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, site_domain)
      );
    `);

    console.log('✅ Backend enhancements migration complete');
  }
};
