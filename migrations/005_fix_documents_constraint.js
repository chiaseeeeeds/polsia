module.exports = {
  name: 'fix_documents_constraint',
  up: async (client) => {
    // Add unique constraint for documents so ON CONFLICT works properly
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_company_type
      ON documents(company_id, type)
    `);
  }
};
