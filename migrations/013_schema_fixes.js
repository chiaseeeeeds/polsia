/**
 * Schema Fixes
 *
 * Adds missing columns referenced by server.js:
 * - conversations.agent_id
 * - agents.icon
 */
module.exports = {
  name: '013_schema_fixes',

  async up(client) {
    console.log('🔄 Running schema fixes migration');

    // Add agent_id to conversations
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id BIGINT REFERENCES agents(id);
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Add icon to agents
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🤖';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Add description to agents (used in agent detail view)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    console.log('✅ Schema fixes migration complete');
  }
};
