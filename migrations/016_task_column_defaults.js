/**
 * Add default values to tasks columns that are NOT NULL but lack defaults.
 * This prevents INSERT failures when these columns aren't explicitly provided.
 */
module.exports = {
  name: '016_task_column_defaults',

  async up(client) {
    console.log('🔄 Adding default values to tasks columns');

    // complexity: default 3 (medium complexity)
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN complexity SET DEFAULT 3
    `);

    // estimated_hours: default 1.0
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN estimated_hours SET DEFAULT 1.0
    `);

    // executability_type: default 'full' (fully executable by agent)
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN executability_type SET DEFAULT 'full'
    `);

    // task_type: default 'general'
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN task_type SET DEFAULT 'general'
    `);

    // Backfill any NULL values (shouldn't exist but just in case)
    await client.query(`
      UPDATE tasks SET complexity = 3 WHERE complexity IS NULL
    `);
    await client.query(`
      UPDATE tasks SET estimated_hours = 1.0 WHERE estimated_hours IS NULL
    `);
    await client.query(`
      UPDATE tasks SET executability_type = 'full' WHERE executability_type IS NULL
    `);
    await client.query(`
      UPDATE tasks SET task_type = 'general' WHERE task_type IS NULL
    `);

    console.log('✅ Task column defaults added');
  }
};
