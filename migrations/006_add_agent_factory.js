module.exports = {
  name: 'add_agent_factory',
  up: async (client) => {
    // Add columns for custom agents
    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS mcp_mounts TEXT[] DEFAULT ARRAY[]::TEXT[]
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS model VARCHAR(50) DEFAULT 'gpt-4o'
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_turns INTEGER DEFAULT 200
    `);

    // Add indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_custom ON agents(company_id, is_custom)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(company_id, enabled)`);
  }
};
