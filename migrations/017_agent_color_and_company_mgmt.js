/**
 * Migration 017: Fix agent creation + company management
 *
 * 1. Adds missing `color` column to agents (root cause of agent creation bug)
 * 2. Creates user_companies join table for multi-company support
 * 3. Seeds user_companies from existing companies.owner_id
 * 4. Adds active_company_id to sessions
 */
module.exports = {
  name: '017_agent_color_and_company_mgmt',

  async up(client) {
    console.log('🔄 Running agent color + company management migration');

    // 1. Fix agent creation: add missing color column
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#00e599';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // 2. Create user_companies join table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, company_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
    `);

    // 3. Seed user_companies from existing companies
    await client.query(`
      INSERT INTO user_companies (user_id, company_id, role)
      SELECT owner_id, id, 'owner' FROM companies
      WHERE owner_id IS NOT NULL
      ON CONFLICT (user_id, company_id) DO NOTHING;
    `);

    // 4. Add active_company_id to sessions
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_company_id BIGINT REFERENCES companies(id);
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // 5. Populate active_company_id for existing sessions
    await client.query(`
      UPDATE sessions s
      SET active_company_id = c.id
      FROM companies c
      WHERE s.user_id = c.owner_id
      AND s.active_company_id IS NULL;
    `);

    console.log('✅ Agent color + company management migration complete');
  }
};
