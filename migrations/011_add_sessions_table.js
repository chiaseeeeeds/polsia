/**
 * Add sessions table for authentication
 * Migration 010 dropped it but never recreated it
 */

module.exports = {
  async up(client) {
    console.log('Creating sessions table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data JSONB DEFAULT '{}',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);

    console.log('✅ Sessions table created');
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
  }
};
