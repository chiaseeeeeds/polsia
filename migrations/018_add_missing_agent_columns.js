module.exports = {
  name: 'add_missing_agent_columns',
  up: async (client) => {
    // Add columns that were dropped by migration 010
    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id)
    `);

    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS mcp_mounts TEXT[] DEFAULT ARRAY[]::TEXT[]
    `);

    console.log('✅ Added missing agent columns: is_custom, created_by, mcp_mounts');
  }
};
