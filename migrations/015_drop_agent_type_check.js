/**
 * Drop the restrictive CHECK constraint on agents.type
 * The system uses flexible agent types (ceo, engineering, research, browser, etc.)
 */
module.exports = {
  name: '015_drop_agent_type_check',

  async up(client) {
    console.log('🔄 Dropping agents_type_check constraint');

    // Drop the check constraint if it exists
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_type_check;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not drop agents_type_check: %', SQLERRM;
      END $$;
    `);

    console.log('✅ agents_type_check constraint dropped');
  }
};
