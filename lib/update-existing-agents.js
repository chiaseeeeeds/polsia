// Update existing agents with full system prompts
const { Pool } = require('pg');
const { POLSIA_AGENTS } = require('./seed-agents');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function updateExistingAgents() {
  console.log('Updating existing agents with full system prompts...\n');

  try {
    for (const agentDef of POLSIA_AGENTS) {
      console.log(`Updating ${agentDef.name}...`);

      const result = await pool.query(
        `UPDATE agents
         SET system_prompt = $1,
             type = $2,
             max_turns = $3,
             updated_at = NOW()
         WHERE name = $4
         RETURNING id, name`,
        [agentDef.system_prompt, agentDef.type, 200, agentDef.name]
      );

      if (result.rows.length > 0) {
        console.log(`✓ Updated ${agentDef.name} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`⚠ ${agentDef.name} not found`);
      }
    }

    console.log('\n✓ All agents updated!');
  } catch (e) {
    console.error('Error updating agents:', e);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateExistingAgents();
}

module.exports = { updateExistingAgents };
