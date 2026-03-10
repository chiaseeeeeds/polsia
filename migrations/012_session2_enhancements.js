/**
 * Session 2 Enhancements
 *
 * Adds tables and columns for:
 * - Recurring task runs tracking
 * - Enhanced onboarding data
 * - Cycle engine improvements
 * - Memory auto-save tracking
 */
module.exports = {
  name: '012_session2_enhancements',

  async up(client) {
    console.log('🔄 Running Session 2 enhancements migration');

    // Recurring task runs tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_task_runs (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        recurring_task_id BIGINT NOT NULL,
        task_id BIGINT,
        status TEXT DEFAULT 'created',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recurring_runs_recurring ON recurring_task_runs(recurring_task_id);
      CREATE INDEX IF NOT EXISTS idx_recurring_runs_task ON recurring_task_runs(task_id);
    `);

    // Ensure conversations has message_count and last_memory_save_at
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_memory_save_at TIMESTAMPTZ;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Ensure companies has onboarding fields
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS cycle_time TEXT DEFAULT '02:00';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS cycles_enabled BOOLEAN DEFAULT true;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Ensure activity_feed exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_id BIGINT NOT NULL,
        agent_id BIGINT,
        task_id BIGINT,
        execution_id BIGINT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_feed(company_id);`);

    // Ensure sessions table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);

    console.log('✅ Session 2 enhancements migration complete');
  }
};
