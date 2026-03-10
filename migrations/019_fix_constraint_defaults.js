module.exports = {
  name: 'fix_constraint_defaults',
  up: async (client) => {
    // Fix executability_type default from 'full' (invalid) to 'can_run_now' (valid per CHECK constraint)
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN executability_type SET DEFAULT 'can_run_now'
    `);

    // Fix any existing rows that might have invalid executability_type
    await client.query(`
      UPDATE tasks SET executability_type = 'can_run_now'
      WHERE executability_type NOT IN ('can_run_now', 'needs_new_connection', 'manual_task')
    `);

    // Ensure priority default matches CHECK constraint
    await client.query(`
      ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'medium'
    `);

    // Fix any existing rows with invalid priority
    await client.query(`
      UPDATE tasks SET priority = 'medium'
      WHERE priority NOT IN ('low', 'medium', 'high', 'critical')
    `);

    // Fix any existing rows with invalid tag
    await client.query(`
      UPDATE tasks SET tag = 'engineering'
      WHERE tag NOT IN ('engineering', 'research', 'browser', 'growth', 'content', 'data', 'support', 'meta_ads')
    `);

    // Fix any existing rows with invalid task_category
    await client.query(`
      UPDATE tasks SET task_category = 'engineering'
      WHERE task_category NOT IN ('engineering', 'research', 'growth', 'content', 'support', 'data', 'ops')
    `);

    // Fix any complexity out of range
    await client.query(`
      UPDATE tasks SET complexity = LEAST(GREATEST(complexity, 1), 10)
      WHERE complexity < 1 OR complexity > 10
    `);

    // Fix any estimated_hours exceeding limit
    await client.query(`
      UPDATE tasks SET estimated_hours = 4.0 WHERE estimated_hours > 4.0
    `);
  }
};
