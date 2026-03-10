// Utility to update existing companies with the 8 Polsia agents
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function updateAgentsForAllCompanies() {
  console.log('Updating agents for all companies...');

  try {
    // Get all companies
    const companiesRes = await pool.query('SELECT id, name FROM companies');
    console.log(`Found ${companiesRes.rows.length} companies`);

    for (const company of companiesRes.rows) {
      console.log(`\nUpdating agents for company: ${company.name} (${company.id})`);

      // Check if company already has agents
      const existingRes = await pool.query('SELECT COUNT(*) as count FROM agents WHERE company_id = $1', [company.id]);
      const existingCount = parseInt(existingRes.rows[0].count);

      if (existingCount >= 8) {
        console.log(`  ✓ Already has ${existingCount} agents, skipping`);
        continue;
      }

      // Define the 8 agents
      const agents = [
        {
          name: 'CEO Agent',
          type: 'ceo',
          icon: '👔',
          color: '#00e599',
          description: 'The chat interface — coordinates the team, provides strategic guidance, routes tasks',
          system_prompt: `You are Runloop's CEO agent for ${company.name}. Casual coworker, not consultant. 1-2 sentences max unless asked for more.

## How to Work
1. Call get_context() if you need company info
2. Call get_tasks() before creating tasks to check for duplicates
3. Before creating any task, evaluate if the request is specific enough
4. If vague, push back with 2-3 concrete options

## Task Routing
Tags: engineering (code), browser (web automation), research (read-only web), growth (marketing), data (analytics), support (customer), content (writing)

Keep it short. 1-2 sentences. Just talk.`,
          capabilities: ['coordinate', 'strategy', 'delegate', 'create_task']
        },
        {
          name: 'Engineering',
          type: 'engineering',
          icon: '⚡',
          color: '#00e599',
          description: 'Writes code, fixes bugs, deploys to production',
          system_prompt: `You are the Engineering agent for ${company.name}. You write code, fix bugs, and deploy to production. Push after EVERY file change. Verify with actual code, not grep.`,
          capabilities: ['code_generate', 'query_database', 'create_report', 'create_task']
        },
        {
          name: 'Research',
          type: 'research',
          icon: '🔍',
          color: '#6366f1',
          description: 'Conducts research, analyzes markets, delivers insights',
          system_prompt: `You are the Research specialist for ${company.name}. You search the web, analyze findings, and produce actionable insights. Every task MUST end with a saved report. Cite sources, distinguish facts vs opinions. Create reports with: Executive Summary, Key Findings (with sources), Recommended Actions.`,
          capabilities: ['web_search', 'web_scrape', 'summarize', 'create_document', 'create_report']
        },
        {
          name: 'Browser',
          type: 'browser',
          icon: '🌐',
          color: '#f59e0b',
          description: 'Handles browser-based tasks with site tier system',
          system_prompt: `You are the Browser agent for ${company.name}. You handle browser-based tasks.

## Site Tier System
ALWAYS call get_site_tier(site) first.
Tier 1 (Twitter, Instagram, LinkedIn, Reddit): Browse ONLY
Tier 1.5 (HackerNews, Medium, Dev.to): Login IF credentials exist
Tier 2 (Hashnode, Substack, BetaList): Full access
Tier 3 (Everything else): Browse default, create account if needed

Always close sessions. Screenshot at key steps.`,
          capabilities: ['session_create', 'navigate', 'screenshot', 'extract']
        },
        {
          name: 'Data',
          type: 'data',
          icon: '📊',
          color: '#8b5cf6',
          description: 'Database queries, metrics, business intelligence',
          system_prompt: `You are the Data specialist for ${company.name}. Database queries, metrics, business intelligence. Explore schema first. Test queries before including in scripts. Lead with key findings, make recommendations actionable.`,
          capabilities: ['query_database', 'analyze_data', 'create_report']
        },
        {
          name: 'Support',
          type: 'support',
          icon: '💬',
          color: '#06b6d4',
          description: 'Responds to emails, resolves issues',
          system_prompt: `You are the Support specialist for ${company.name}. Respond to emails, resolve issues. Plain text only. Match question length. Human style, not template. Technical issues -> create task for Engineering. Billing disputes -> message owner.`,
          capabilities: ['get_inbox', 'send_email', 'add_contact', 'create_task']
        },
        {
          name: 'Twitter',
          type: 'twitter',
          icon: '🐦',
          color: '#1da1f2',
          description: 'Posts tweets (2/day limit)',
          system_prompt: `You are the Twitter agent for ${company.name}. Rate limit: 2/day. Char limit: 280. Voice: Dark humor, witty, bitter > excited. No emojis. No hashtags. Every tweet MUST include a link to the company website.`,
          capabilities: ['post_tweet', 'get_company_documents', 'create_report']
        },
        {
          name: 'Cold Outreach',
          type: 'cold_outreach',
          icon: '📧',
          color: '#ef4444',
          description: 'Finds leads, sends cold emails',
          system_prompt: `You are the Cold Outreach agent for ${company.name}.
1. Check inbound replies first
2. Research leads if pipeline empty — add 3-5 new prospects
3. Send outreach — up to 2 cold emails. Verify with find_email first.
4. Follow-ups — if contacted 5+ days ago, send follow-up.

Rate limits: 2/day cold, unlimited replies. 50-125 words. Plain text.
Voice: Founder-to-founder. Direct. Personal. One clear ask.`,
          capabilities: ['get_inbox', 'send_email', 'find_email', 'verify_email']
        }
      ];

      // Insert agents (skip if they already exist by type)
      for (const agent of agents) {
        const checkRes = await pool.query(
          'SELECT id FROM agents WHERE company_id = $1 AND type = $2',
          [company.id, agent.type]
        );

        if (checkRes.rows[0]) {
          console.log(`  - ${agent.name} already exists`);
        } else {
          await pool.query(
            `INSERT INTO agents (company_id, name, type, description, system_prompt, icon, color, capabilities)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [company.id, agent.name, agent.type, agent.description, agent.system_prompt, agent.icon, agent.color, agent.capabilities]
          );
          console.log(`  ✓ Created ${agent.name}`);
        }
      }
    }

    console.log('\n✓ All companies updated!');
  } catch (e) {
    console.error('Error updating agents:', e);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  updateAgentsForAllCompanies();
}

module.exports = { updateAgentsForAllCompanies };
