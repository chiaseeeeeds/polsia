const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 10000;

// ─── Utility Functions ──────────────────────────────────
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

async function generateUniqueSlug(baseName, pool) {
  let slug = slugify(baseName);
  let attempt = 0;

  while (true) {
    const testSlug = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await pool.query('SELECT id FROM companies WHERE slug = $1', [testSlug]);
    if (existing.rows.length === 0) return testSlug;
    attempt++;
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// ─── Task Validation Helpers (matches DB CHECK constraints) ──────────────
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_TAGS = ['engineering', 'research', 'browser', 'growth', 'content', 'data', 'support', 'meta_ads'];
const VALID_TASK_CATEGORIES = ['engineering', 'research', 'growth', 'content', 'support', 'data', 'ops'];
const VALID_EXECUTABILITY = ['can_run_now', 'needs_new_connection', 'manual_task'];
const VALID_STATUSES = ['suggested', 'todo', 'in_progress', 'blocked', 'waiting', 'completed', 'failed', 'rejected'];
const VALID_SOURCES = ['owner_request', 'agent_generated', 'monitoring', 'bug', 'cycle'];

function sanitizePriority(val) {
  if (typeof val === 'number') {
    const map = { 1: 'low', 2: 'low', 3: 'medium', 4: 'medium', 5: 'medium', 6: 'high', 7: 'high', 8: 'high', 9: 'critical', 10: 'critical' };
    return map[val] || 'medium';
  }
  const s = String(val || 'medium').toLowerCase().trim();
  return VALID_PRIORITIES.includes(s) ? s : 'medium';
}

function sanitizeTag(val) {
  const s = String(val || 'engineering').toLowerCase().trim();
  return VALID_TAGS.includes(s) ? s : 'engineering';
}

function sanitizeTaskCategory(val) {
  const s = String(val || 'engineering').toLowerCase().trim();
  return VALID_TASK_CATEGORIES.includes(s) ? s : 'engineering';
}

function sanitizeComplexity(val) {
  const n = parseInt(val) || 3;
  return Math.max(1, Math.min(10, n));
}

function sanitizeEstimatedHours(val) {
  const n = parseFloat(val) || 1.0;
  return Math.max(0.25, Math.min(4.0, n));
}

function sanitizeExecutabilityType(val) {
  const s = String(val || 'can_run_now').toLowerCase().trim();
  return VALID_EXECUTABILITY.includes(s) ? s : 'can_run_now';
}

function sanitizeSource(val) {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  return VALID_SOURCES.includes(s) ? s : null;
}

// Trust proxy for Render
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session middleware ──────────────────────────────────
function generateSessionId() {
  return crypto.randomBytes(48).toString('hex');
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  try {
    const res = await pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    );
    return res.rows[0] || null;
  } catch { return null; }
}

async function createSession(userId) {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [id, userId, expiresAt]
  );
  return id;
}

async function destroySession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

// Cookie parser middleware
function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const [key, ...val] = c.trim().split('=');
      cookies[key] = val.join('=');
    });
  }
  return cookies;
}

// Auth middleware
async function authMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const sessionId = cookies['session'];
  if (!sessionId) return res.redirect('/login');

  const session = await getSession(sessionId);
  if (!session) return res.redirect('/login');

  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [session.user_id]);
  if (!userRes.rows[0]) return res.redirect('/login');

  req.user = userRes.rows[0];
  req.sessionId = sessionId;

  // Use active_company_id from session, fallback to owned company
  if (session.active_company_id) {
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [session.active_company_id]);
    if (companyRes.rows[0]) {
      req.user.company_id = companyRes.rows[0].id;
      req.company = companyRes.rows[0];
    }
  }
  if (!req.company) {
    const companyRes = await pool.query('SELECT * FROM companies WHERE owner_id = $1 LIMIT 1', [req.user.id]);
    if (companyRes.rows[0]) {
      req.user.company_id = companyRes.rows[0].id;
      req.company = companyRes.rows[0];
    }
  }

  next();
}

// API auth middleware (returns JSON)
async function apiAuth(req, res, next) {
  const cookies = parseCookies(req);
  const sessionId = cookies['session'];
  const authHeader = req.headers.authorization;

  let userId = null;
  let activeCompanyId = null;

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      userId = session.user_id;
      activeCompanyId = session.active_company_id;
    }
  }

  if (!userId && authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7);
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyRes = await pool.query('SELECT user_id FROM api_keys WHERE key_hash = $1', [keyHash]);
    if (keyRes.rows[0]) {
      userId = keyRes.rows[0].user_id;
      await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash]);
    }
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!userRes.rows[0]) return res.status(401).json({ error: 'User not found' });

  req.user = userRes.rows[0];

  // Use active_company_id from session, fallback to owned company
  if (activeCompanyId) {
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [activeCompanyId]);
    if (companyRes.rows[0]) {
      req.user.company_id = companyRes.rows[0].id;
      req.company = companyRes.rows[0];
    }
  }
  if (!req.user.company_id) {
    const companyRes = await pool.query('SELECT * FROM companies WHERE owner_id = $1 LIMIT 1', [req.user.id]);
    if (companyRes.rows[0]) {
      req.user.company_id = companyRes.rows[0].id;
      req.company = companyRes.rows[0];
    }
  }

  next();
}

// ─── Health ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    res.json({ status: 'healthy', db: 'connected', db_latency_ms: dbLatency, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'degraded', db: 'disconnected', error: e.message });
  }
});

// ─── Auth API ──────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const userRes = await pool.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase(), name || email.split('@')[0], passwordHash]
    );
    const user = userRes.rows[0];

    // Create default company with unique slug
    const companyName = name ? `${name}'s Company` : 'My Company';
    const slug = await generateUniqueSlug(companyName, pool);

    const companyRes = await pool.query(
      'INSERT INTO companies (name, slug, description, owner_id, status, cycles_completed, tasks_completed) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, slug',
      [companyName, slug, 'My autonomous AI company', user.id, 'active', 0, 0]
    );
    const company = companyRes.rows[0];

    // Create default agents for new company
    await seedAgentsForCompany(company.id);

    // Add to user_companies join table
    await pool.query(
      'INSERT INTO user_companies (user_id, company_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [user.id, company.id, 'owner']
    );

    const sessionId = await createSession(user.id);
    // Set active company on session
    await pool.query('UPDATE sessions SET active_company_id = $1 WHERE id = $2', [company.id, sessionId]);
    res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*24*60*60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name }, redirect: '/onboarding' });
  } catch (e) {
    console.error('Signup error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = userRes.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const sessionId = await createSession(user.id);
    res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*24*60*60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name }, redirect: '/chat' });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const cookies = parseCookies(req);
  if (cookies['session']) await destroySession(cookies['session']);
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/auth/me', apiAuth, async (req, res) => {
  // Return active company (from session) + list of all user companies
  const companiesRes = await pool.query(
    `SELECT c.*, uc.role FROM companies c
     JOIN user_companies uc ON uc.company_id = c.id
     WHERE uc.user_id = $1
     ORDER BY c.created_at ASC`,
    [req.user.id]
  );
  // Fallback: if user_companies is empty (legacy), try owner_id
  let companies = companiesRes.rows;
  if (companies.length === 0) {
    const fallback = await pool.query('SELECT * FROM companies WHERE owner_id = $1', [req.user.id]);
    companies = fallback.rows;
  }
  const activeCompany = req.company || companies[0] || null;
  res.json({
    user: { id: req.user.id, email: req.user.email, name: req.user.name },
    company: activeCompany,
    companies: companies
  });
});

// ─── Company Management API ──────────────────────────────────
app.get('/api/companies', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, uc.role FROM companies c
       JOIN user_companies uc ON uc.company_id = c.id
       WHERE uc.user_id = $1
       ORDER BY c.created_at ASC`,
      [req.user.id]
    );
    // Fallback for legacy data
    if (result.rows.length === 0) {
      const fallback = await pool.query('SELECT *, \'owner\' as role FROM companies WHERE owner_id = $1', [req.user.id]);
      return res.json({ companies: fallback.rows, active_company_id: req.user.company_id });
    }
    res.json({ companies: result.rows, active_company_id: req.user.company_id });
  } catch (e) {
    console.error('List companies error:', e);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

app.post('/api/companies', apiAuth, async (req, res) => {
  try {
    const { name, description, industry } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });

    const slug = await generateUniqueSlug(name, pool);
    const companyRes = await pool.query(
      `INSERT INTO companies (name, slug, description, industry, owner_id, status, cycles_completed, tasks_completed)
       VALUES ($1, $2, $3, $4, $5, 'active', 0, 0) RETURNING *`,
      [name, slug, description || '', industry || '', req.user.id]
    );
    const company = companyRes.rows[0];

    // Add to user_companies
    await pool.query(
      'INSERT INTO user_companies (user_id, company_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.user.id, company.id, 'owner']
    );

    // Seed default agents
    await seedAgentsForCompany(company.id);

    // Switch active company to new one
    const cookies = parseCookies(req);
    const sessionId = cookies['session'];
    if (sessionId) {
      await pool.query('UPDATE sessions SET active_company_id = $1 WHERE id = $2', [company.id, sessionId]);
    }

    res.json({ company });
  } catch (e) {
    console.error('Create company error:', e);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

app.put('/api/companies/:id', apiAuth, async (req, res) => {
  try {
    const { name, description, industry } = req.body;
    const companyId = req.params.id;

    // Verify user owns this company
    const check = await pool.query(
      'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [req.user.id, companyId]
    );
    if (!check.rows[0]) {
      // Fallback check
      const fallback = await pool.query('SELECT 1 FROM companies WHERE id = $1 AND owner_id = $2', [companyId, req.user.id]);
      if (!fallback.rows[0]) return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `UPDATE companies SET name = COALESCE($1, name), description = COALESCE($2, description),
       industry = COALESCE($3, industry), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name, description, industry, companyId]
    );
    res.json({ company: result.rows[0] });
  } catch (e) {
    console.error('Update company error:', e);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

app.delete('/api/companies/:id', apiAuth, async (req, res) => {
  try {
    const companyId = req.params.id;

    // Verify ownership
    const check = await pool.query('SELECT 1 FROM companies WHERE id = $1 AND owner_id = $2', [companyId, req.user.id]);
    if (!check.rows[0]) return res.status(403).json({ error: 'Only the owner can delete a company' });

    // Don't allow deleting last company
    const countRes = await pool.query(
      'SELECT COUNT(*) as cnt FROM user_companies WHERE user_id = $1',
      [req.user.id]
    );
    if (parseInt(countRes.rows[0].cnt) <= 1) {
      return res.status(400).json({ error: 'Cannot delete your only company' });
    }

    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);

    // Switch to another company
    const nextCompany = await pool.query(
      `SELECT c.id FROM companies c JOIN user_companies uc ON uc.company_id = c.id WHERE uc.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    const cookies = parseCookies(req);
    const sessionId = cookies['session'];
    if (sessionId && nextCompany.rows[0]) {
      await pool.query('UPDATE sessions SET active_company_id = $1 WHERE id = $2', [nextCompany.rows[0].id, sessionId]);
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Delete company error:', e);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

app.post('/api/companies/switch', apiAuth, async (req, res) => {
  try {
    const { company_id } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });

    // Verify user has access
    const check = await pool.query(
      'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [req.user.id, company_id]
    );
    if (!check.rows[0]) {
      // Fallback
      const fallback = await pool.query('SELECT 1 FROM companies WHERE id = $1 AND owner_id = $2', [company_id, req.user.id]);
      if (!fallback.rows[0]) return res.status(403).json({ error: 'Access denied' });
    }

    // Update session
    const cookies = parseCookies(req);
    const sessionId = cookies['session'];
    if (sessionId) {
      await pool.query('UPDATE sessions SET active_company_id = $1 WHERE id = $2', [company_id, sessionId]);
    }

    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [company_id]);
    res.json({ success: true, company: companyRes.rows[0] });
  } catch (e) {
    console.error('Switch company error:', e);
    res.status(500).json({ error: 'Failed to switch company' });
  }
});

// ─── Company Document Generator ──────────────────────────────────
async function generateCompanyDocuments(companyName, description, industry) {
  try {
    const prompt = `Generate three foundational documents for a company called "${companyName}".

Company description: ${description}
Industry: ${industry}

Generate:
1. Mission statement (2-3 sentences about company purpose and goals)
2. Product overview (brief description of what they build/offer)
3. Brand voice guidelines (tone, style, key messaging principles)

Return as JSON array with format: [{ type: "mission", content: "..." }, { type: "product_overview", content: "..." }, { type: "brand_voice", content: "..." }]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a business strategist helping companies define their identity. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    const docs = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

    return docs.map(d => ({
      type: d.type,
      title: d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: d.content
    }));
  } catch (e) {
    console.error('Generate docs error:', e);
    // Return basic fallback docs
    return [
      { type: 'mission', title: 'Mission', content: `${companyName} is building innovative solutions in the ${industry} space.` },
      { type: 'product_overview', title: 'Product Overview', content: description || 'Product details coming soon.' },
      { type: 'brand_voice', title: 'Brand Voice', content: 'Our brand voice is professional, clear, and customer-focused.' }
    ];
  }
}

// ─── Onboarding API ──────────────────────────────────
app.post('/api/onboarding', apiAuth, async (req, res) => {
  try {
    const { companyName, companyDescription, industry, size, selectedAgents } = req.body;
    const companyId = req.user.company_id;

    if (companyId) {
      await pool.query(
        'UPDATE companies SET name = $1, description = $2, industry = $3, size = $4, updated_at = NOW() WHERE id = $5',
        [companyName, companyDescription, industry, size, companyId]
      );

      // Enable/disable agents based on selection
      if (selectedAgents && selectedAgents.length > 0) {
        await pool.query('UPDATE agents SET is_active = false WHERE company_id = $1', [companyId]);
        await pool.query(
          'UPDATE agents SET is_active = true WHERE company_id = $1 AND type = ANY($2)',
          [companyId, selectedAgents]
        );
      }

      // Auto-generate company documents using LLM
      try {
        const docs = await generateCompanyDocuments(companyName, companyDescription, industry);
        for (const doc of docs) {
          await pool.query(
            `INSERT INTO documents (company_id, type, title, content, created_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [companyId, doc.type, doc.title, doc.content, req.user.id]
          );
        }
      } catch (e) {
        console.error('Document generation error:', e);
        // Continue even if docs fail
      }
    }

    res.json({ success: true, redirect: '/chat' });
  } catch (e) {
    console.error('Onboarding error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Enhanced Onboarding Wizard API ──────────────────────────────────
app.post('/api/onboarding/start', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await pool.query(
      'UPDATE companies SET onboarding_step = 1, onboarding_data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify({}), companyId]
    );
    res.json({ success: true, step: 1 });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/onboarding/step/:step', apiAuth, async (req, res) => {
  try {
    const step = parseInt(req.params.step);
    const companyId = req.user.company_id;
    const data = req.body;

    // Get current onboarding data
    const companyRes = await pool.query('SELECT onboarding_data FROM companies WHERE id = $1', [companyId]);
    const currentData = companyRes.rows[0]?.onboarding_data || {};

    // Merge step data
    const updatedData = { ...currentData, [`step${step}`]: data };

    // Update company based on step
    if (step === 1 && data.companyName) {
      await pool.query(
        'UPDATE companies SET name = $1, onboarding_step = $2, onboarding_data = $3, updated_at = NOW() WHERE id = $4',
        [data.companyName, step, JSON.stringify(updatedData), companyId]
      );
    } else if (step === 2 && data.description) {
      await pool.query(
        'UPDATE companies SET description = $1, onboarding_step = $2, onboarding_data = $3, updated_at = NOW() WHERE id = $4',
        [data.description, step, JSON.stringify(updatedData), companyId]
      );
    } else if (step === 3 && data.industry) {
      await pool.query(
        'UPDATE companies SET industry = $1, onboarding_step = $2, onboarding_data = $3, updated_at = NOW() WHERE id = $4',
        [data.industry, step, JSON.stringify(updatedData), companyId]
      );
    } else {
      await pool.query(
        'UPDATE companies SET onboarding_step = $1, onboarding_data = $2, updated_at = NOW() WHERE id = $3',
        [step, JSON.stringify(updatedData), companyId]
      );
    }

    res.json({ success: true, step, data: updatedData });
  } catch (e) {
    console.error('Onboarding step error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/onboarding/complete', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { selectedAgents, communicationStyle } = req.body;

    // Get company info for doc generation
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];

    // Enable/disable agents based on selection
    if (selectedAgents && selectedAgents.length > 0) {
      await pool.query('UPDATE agents SET is_active = false WHERE company_id = $1', [companyId]);
      for (const agentType of selectedAgents) {
        await pool.query('UPDATE agents SET is_active = true WHERE company_id = $1 AND type = $2', [companyId, agentType]);
      }
    }

    // Auto-generate ALL 5 document types
    try {
      const docPrompt = `Generate five foundational documents for "${company.name}".
Description: ${company.description || 'A new company'}
Industry: ${company.industry || 'Technology'}

Generate ALL 5 document types as markdown:
1. mission — Company mission statement (2-3 paragraphs)
2. product_overview — What the company builds/offers (2-3 paragraphs)
3. tech_notes — Technical stack, architecture decisions, conventions
4. brand_voice — Tone, style, messaging principles, communication guidelines${communicationStyle ? `. Preferred style: ${communicationStyle}` : ''}
5. user_research — Target users, pain points, personas, market positioning

Return as JSON array: [{ "type": "mission", "content": "..." }, ...]`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a business strategist. Return only valid JSON array.' },
          { role: 'user', content: docPrompt }
        ],
        temperature: 0.8,
        max_tokens: 3000
      });

      const response = completion.choices[0].message.content;
      const docs = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

      for (const doc of docs) {
        await pool.query(
          `INSERT INTO documents (company_id, type, content) VALUES ($1, $2, $3)
           ON CONFLICT (company_id, type) DO UPDATE SET content = $3, updated_at = NOW()`,
          [companyId, doc.type, doc.content]
        );
      }
    } catch (e) {
      console.error('Doc generation error:', e);
      // Fallback docs
      const fallbackDocs = [
        { type: 'mission', content: `# Mission\n\n${company.name} is building innovative solutions in the ${company.industry || 'technology'} space.` },
        { type: 'product_overview', content: `# Product Overview\n\n${company.description || 'Our product helps businesses operate more efficiently.'}` },
        { type: 'tech_notes', content: '# Tech Notes\n\nTechnical documentation will be added as the product evolves.' },
        { type: 'brand_voice', content: '# Brand Voice\n\nOur brand voice is professional, clear, and customer-focused.' },
        { type: 'user_research', content: '# User Research\n\nUser research and personas will be documented here.' }
      ];
      for (const doc of fallbackDocs) {
        await pool.query(
          `INSERT INTO documents (company_id, type, content) VALUES ($1, $2, $3) ON CONFLICT (company_id, type) DO UPDATE SET content = $3, updated_at = NOW()`,
          [companyId, doc.type, doc.content]
        );
      }
    }

    // Save preferences to memory layer 2
    if (communicationStyle) {
      const prefContent = `Communication style: ${communicationStyle}`;
      const existing = await pool.query('SELECT id FROM memory_layer2 WHERE company_id = $1', [companyId]);
      if (existing.rows[0]) {
        await pool.query('UPDATE memory_layer2 SET content = $1, updated_at = NOW() WHERE company_id = $2', [prefContent, companyId]);
      } else {
        await pool.query('INSERT INTO memory_layer2 (company_id, content, metadata) VALUES ($1, $2, $3)', [companyId, prefContent, JSON.stringify({ source: 'onboarding' })]);
      }
    }

    // Create 2-3 starter tasks
    const ceoAgent = await pool.query('SELECT id FROM agents WHERE company_id = $1 AND type = $2 LIMIT 1', [companyId, 'ceo']);
    const ceoId = ceoAgent.rows[0]?.id;
    const researchAgent = await pool.query('SELECT id FROM agents WHERE company_id = $1 AND type = $2 LIMIT 1', [companyId, 'research']);
    const researchId = researchAgent.rows[0]?.id;

    const starterTasks = [
      { title: 'Research your market', description: `Research the ${company.industry || 'technology'} market for ${company.name}. Identify key competitors, market trends, and opportunities.`, agent_id: researchId },
      { title: 'Set up your brand voice', description: `Review and refine the brand voice document for ${company.name}. Make it distinct and memorable.`, agent_id: ceoId },
      { title: 'Plan your first campaign', description: `Create a marketing plan for ${company.name}. Identify channels, messaging, and timeline for initial launch.`, agent_id: ceoId }
    ];

    for (const task of starterTasks) {
      try {
        await pool.query(
          `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type)
           VALUES ($1, $2, $3, $4, 'medium', 'todo', $5, $6, $7, 'can_run_now', 3, 1.0, 'task')`,
          [companyId, task.title, task.description, task.agent_id, 'Starter task for new company', 'engineering', 'engineering']
        );
      } catch (e) {
        console.error('Starter task error:', e);
      }
    }

    // Mark onboarding complete
    await pool.query(
      'UPDATE companies SET onboarding_completed = true, onboarding_step = 5, updated_at = NOW() WHERE id = $1',
      [companyId]
    );

    // Create welcome message in chat
    try {
      const enabledAgents = await pool.query('SELECT COUNT(*) as count FROM agents WHERE company_id = $1 AND is_active = true', [companyId]);
      const agentCount = enabledAgents.rows[0]?.count || 8;

      // Create a conversation for the welcome message
      const convRes = await pool.query(
        `INSERT INTO conversations (company_id, user_id, agent_id, title) VALUES ($1, $2, $3, $4) RETURNING id`,
        [companyId, req.user.id, ceoId, 'Welcome to Runloop!']
      );

      const welcomeMsg = `Hey! 👋 I'm your CEO agent. I've set up ${agentCount} agents and created a few starter tasks for you. Your company documents are ready — you can check them out in the Documents section.\n\nWhat should we tackle first?`;

      await pool.query(
        'INSERT INTO messages (conversation_id, role, content, agent_id) VALUES ($1, $2, $3, $4)',
        [convRes.rows[0].id, 'assistant', welcomeMsg, ceoId]
      );
    } catch (e) {
      console.error('Welcome message error:', e);
    }

    res.json({ success: true, redirect: '/chat' });
  } catch (e) {
    console.error('Onboarding complete error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check onboarding status
app.get('/api/onboarding/status', apiAuth, async (req, res) => {
  try {
    const companyRes = await pool.query(
      'SELECT onboarding_completed, onboarding_step, onboarding_data FROM companies WHERE id = $1',
      [req.user.company_id]
    );
    const company = companyRes.rows[0];
    const hasDocs = await pool.query('SELECT COUNT(*) as count FROM documents WHERE company_id = $1', [req.user.company_id]);

    res.json({
      completed: company?.onboarding_completed || false,
      step: company?.onboarding_step || 0,
      data: company?.onboarding_data || {},
      hasDocuments: parseInt(hasDocs.rows[0]?.count) > 0
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Agents API ──────────────────────────────────
app.get('/api/agents', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.json({ agents: [] });

    const result = await pool.query(
      `SELECT a.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent_id = a.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent_id = a.id AND t.status = 'completed') as completed_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent_id = a.id AND t.status = 'in_progress') as running_count
       FROM agents a WHERE a.company_id = $1 ORDER BY a.id`,
      [companyId]
    );
    res.json({ agents: result.rows });
  } catch (e) {
    console.error('Get agents error:', e);
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

app.get('/api/agents/:id', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM agents WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Agent not found' });

    const tools = await pool.query('SELECT * FROM agent_tools WHERE agent_id = $1', [req.params.id]);
    const executions = await pool.query(
      'SELECT e.*, t.title as task_title FROM executions e LEFT JOIN tasks t ON e.task_id = t.id WHERE e.agent_id = $1 ORDER BY e.created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({ agent: result.rows[0], tools: tools.rows, executions: executions.rows });
  } catch (e) {
    console.error('Get agent detail error:', e);
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

app.post('/api/agents/:id/trigger', apiAuth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const agentRes = await pool.query(
      'SELECT * FROM agents WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!agentRes.rows[0]) return res.status(404).json({ error: 'Agent not found' });

    const agent = agentRes.rows[0];

    // Create task
    const taskRes = await pool.query(
      `INSERT INTO tasks (company_id, assigned_agent_id, title, description, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours)
       VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10) RETURNING *`,
      [req.user.company_id, agent.id, title || `Manual task for ${agent.name}`, description || '',
       sanitizePriority(priority), 'Manual agent execution',
       sanitizeTag(req.body.tag), sanitizeTaskCategory(req.body.task_category),
       sanitizeComplexity(req.body.complexity), sanitizeEstimatedHours(req.body.estimated_hours)]
    );

    // Create execution
    const execRes = await pool.query(
      `INSERT INTO executions (task_id, agent_id, company_id, status, logs)
       VALUES ($1, $2, $3, 'running', $4) RETURNING *`,
      [taskRes.rows[0].id, agent.id, req.user.company_id, JSON.stringify([`[${new Date().toISOString()}] Task queued: ${title || 'Manual task'}`])]
    );

    // Update agent status
    await pool.query('UPDATE agents SET last_run_at = NOW() WHERE id = $1', [agent.id]);

    // Simulate async execution
    simulateExecution(taskRes.rows[0].id, execRes.rows[0].id, agent.id, req.user.company_id);

    // Activity feed
    await pool.query(
      `INSERT INTO activity_feed (company_id, agent_id, task_id, execution_id, type, title, description)
       VALUES ($1, $2, $3, $4, 'task_queued', $5, $6)`,
      [req.user.company_id, agent.id, taskRes.rows[0].id, execRes.rows[0].id,
       `Task queued for ${agent.name}`, title || 'Manual task']
    );

    res.json({ success: true, task: taskRes.rows[0], execution: execRes.rows[0] });
  } catch (e) {
    console.error('Trigger error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/agents/:id', apiAuth, async (req, res) => {
  const { enabled, system_prompt, mcp_mounts, model, temperature, max_turns } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (typeof enabled === 'boolean') { updates.push(`is_active = $${idx++}`); values.push(enabled); }
  if (system_prompt) { updates.push(`system_prompt = $${idx++}`); values.push(system_prompt); }
  if (mcp_mounts) { updates.push(`mcp_mounts = $${idx++}`); values.push(mcp_mounts); }
  if (model) { updates.push(`model = $${idx++}`); values.push(model); }
  if (temperature !== undefined) { updates.push(`temperature = $${idx++}`); values.push(temperature); }
  if (max_turns) { updates.push(`max_turns = $${idx++}`); values.push(max_turns); }
  updates.push(`updated_at = NOW()`);

  values.push(req.params.id, req.user.company_id);
  const result = await pool.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${idx++} AND company_id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Agent not found' });
  res.json({ agent: result.rows[0] });
});

// Agent Factory API
app.post('/api/agents', apiAuth, async (req, res) => {
  try {
    const { name, type, description, system_prompt, icon, color, mcp_mounts, tools, model, temperature, max_turns } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({ error: 'Name and system_prompt are required' });
    }

    // Frontend sends "tools", backend stores as "mcp_mounts"
    const resolvedMounts = mcp_mounts || tools || [];

    const agentSlug = (type || 'custom').replace(/[^a-z0-9_]+/g, '-') + '-' + Date.now().toString(36);
    const result = await pool.query(
      `INSERT INTO agents (company_id, name, slug, type, description, system_prompt, icon, color, mcp_mounts, model, temperature, max_turns, is_custom, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13) RETURNING *`,
      [req.user.company_id, name, agentSlug, type || 'custom', description || '', system_prompt, icon || '🤖', color || '#00e599',
       resolvedMounts, model || 'gpt-4o', temperature || 0.7, max_turns || 200, req.user.id]
    );

    res.json({ agent: result.rows[0] });
  } catch (e) {
    console.error('Create agent error:', e);
    res.status(500).json({ error: e.message || 'Failed to create agent' });
  }
});

app.delete('/api/agents/:id', apiAuth, async (req, res) => {
  try {
    // Only allow deleting custom agents
    const result = await pool.query(
      'DELETE FROM agents WHERE id = $1 AND company_id = $2 AND is_custom = true RETURNING id',
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Custom agent not found' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Tasks API ──────────────────────────────────
app.get('/api/tasks', apiAuth, async (req, res) => {
  try {
    const { status, agent_id, limit = 50 } = req.query;
    let query = 'SELECT t.*, a.name as agent_name, a.icon as agent_icon FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id WHERE t.company_id = $1';
    const params = [req.user.company_id];
    let idx = 2;

    if (status) { query += ` AND t.status = $${idx++}`; params.push(status); }
    if (agent_id) { query += ` AND t.assigned_agent_id = $${idx++}`; params.push(agent_id); }

    query += ' ORDER BY t.created_at DESC LIMIT $' + idx;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows });
  } catch (e) {
    console.error('Get tasks error:', e);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

app.post('/api/tasks', apiAuth, async (req, res) => {
  try {
    const { title, description, agent_id, assigned_agent_id, priority, type } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    let targetAgentId = assigned_agent_id || agent_id;

    // Auto-route if no agent specified
    if (!targetAgentId) {
      targetAgentId = await routeTask(title + ' ' + (description || ''), req.user.company_id);
    }

    const result = await pool.query(
      `INSERT INTO tasks (company_id, assigned_agent_id, title, description, priority, task_type, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours)
       VALUES ($1, $2, $3, $4, $5, $6, 'todo', $7, $8, $9, 'can_run_now', $10, $11) RETURNING *`,
      [req.user.company_id, targetAgentId, title, description || '',
       sanitizePriority(priority), type || 'general',
       req.body.suggestion_reasoning || 'User created task',
       sanitizeTag(req.body.tag), sanitizeTaskCategory(req.body.task_category),
       sanitizeComplexity(req.body.complexity), sanitizeEstimatedHours(req.body.estimated_hours)]
    );

    const task = result.rows[0];

    // Create execution and start
    if (targetAgentId) {
      const execRes = await pool.query(
        `INSERT INTO executions (task_id, agent_id, company_id, status, logs)
         VALUES ($1, $2, $3, 'running', $4) RETURNING *`,
        [task.id, targetAgentId, req.user.company_id, JSON.stringify([`[${new Date().toISOString()}] Task created`])]
      );
      await pool.query('UPDATE agents SET last_run_at = NOW() WHERE id = $1', [targetAgentId]);
      simulateExecution(task.id, execRes.rows[0].id, targetAgentId, req.user.company_id);
    }

    res.json({ success: true, task });
  } catch (e) {
    console.error('Task creation error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/tasks/:id', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, a.name as agent_name, a.icon as agent_icon
       FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id
       WHERE t.id = $1 AND t.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });

    // Also get executions for this task
    const executions = await pool.query(
      'SELECT * FROM executions WHERE task_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ task: result.rows[0], executions: executions.rows });
  } catch (e) {
    console.error('Get task detail error:', e);
    res.status(500).json({ error: 'Failed to load task' });
  }
});

app.post('/api/tasks/:id/cancel', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tasks SET status = 'failed', completed_at = NOW() WHERE id = $1 AND company_id = $2 AND status IN ('todo', 'in_progress') RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found or already completed' });

    await pool.query(
      `UPDATE executions SET status = 'cancelled', completed_at = NOW() WHERE task_id = $1 AND status = 'running'`,
      [req.params.id]
    );

    res.json({ success: true, task: result.rows[0] });
  } catch (e) {
    console.error('Cancel task error:', e);
    res.status(500).json({ error: 'Failed to cancel task' });
  }
});

app.post('/api/tasks/:id/score', apiAuth, async (req, res) => {
  try {
    const { score, reasoning } = req.body;
    if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'Score must be 1-10' });
    const result = await pool.query(
      `UPDATE tasks SET score = $1, score_reasoning = $2 WHERE id = $3 AND company_id = $4 AND status = 'completed' RETURNING *`,
      [score, reasoning || '', req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Completed task not found' });
    res.json({ task: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Executions API ──────────────────────────────────
app.get('/api/executions/:id/logs', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM executions WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Execution not found' });
    res.json({ execution: result.rows[0] });
  } catch (e) {
    console.error('Get execution logs error:', e);
    res.status(500).json({ error: 'Failed to load execution logs' });
  }
});

// ─── Activity Feed API ──────────────────────────────────
app.get('/api/activity', apiAuth, async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const result = await pool.query(
      `SELECT af.*, a.name as agent_name, a.icon as agent_icon
       FROM activity_feed af
       LEFT JOIN agents a ON af.agent_id = a.id
       WHERE af.company_id = $1
       ORDER BY af.created_at DESC LIMIT $2`,
      [req.user.company_id, parseInt(limit)]
    );
    res.json({ activities: result.rows });
  } catch (e) {
    console.error('Get activity error:', e);
    res.json({ activities: [] });
  }
});

// ─── Dashboard Stats API ──────────────────────────────────
app.get('/api/dashboard/stats', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.json({ stats: {} });

    const [agents, tasks, executions] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM agents WHERE company_id = $1', [companyId]),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'completed\') as completed, COUNT(*) FILTER (WHERE status = \'in_progress\') as running, COUNT(*) FILTER (WHERE status = \'failed\') as failed FROM tasks WHERE company_id = $1', [companyId]),
      pool.query('SELECT COALESCE(SUM(tokens_used), 0) as total_tokens, COALESCE(SUM(duration_seconds), 0) as total_duration, COUNT(*) as total FROM executions WHERE company_id = $1', [companyId])
    ]);

    res.json({
      stats: {
        agents: agents.rows[0],
        tasks: tasks.rows[0],
        executions: executions.rows[0]
      }
    });
  } catch (e) {
    console.error('Dashboard stats error:', e);
    res.json({ stats: { agents: { total: 0, active: 0 }, tasks: { total: 0, completed: 0, running: 0, failed: 0 }, executions: { total_tokens: 0, total_duration: 0, total: 0 } } });
  }
});

// ─── Tool Registry ──────────────────────────────────
const toolHandlers = {
  web_search: async (params) => {
    try {
      const results = await braveSearch(params.query, params.count || 5);
      if (results.error) return { success: false, error: results.error };
      return { success: true, results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  web_scrape: async (params) => {
    try {
      const resp = await fetch(params.url, {
        headers: { 'User-Agent': 'Runloop/1.0 (AI Agent)' },
        signal: AbortSignal.timeout(15000)
      });
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const html = await resp.text();
      // Strip HTML tags for text content
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000);
      return { success: true, content: text, url: params.url };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  content_generate: async (params) => {
    // Generate content using LLM
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `You are a content writer. Generate ${params.type || 'general'} content with a ${params.tone || 'professional'} tone.` },
          { role: 'user', content: params.prompt || params.topic }
        ],
        max_tokens: params.max_length || 500
      });
      return {
        success: true,
        content: completion.choices[0].message.content
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  summarize: async (params) => {
    // Summarize text using LLM
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a summarization expert. Create concise, clear summaries.' },
          { role: 'user', content: `Summarize this text:\n\n${params.text}` }
        ],
        max_tokens: params.max_length || 300
      });
      return {
        success: true,
        summary: completion.choices[0].message.content
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  create_document: async (params) => {
    // Create or update a company document
    try {
      await pool.query(
        `INSERT INTO documents (company_id, type, title, content, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, type) DO UPDATE SET content = $4, updated_at = NOW()`,
        [params.company_id, params.type, params.title, params.content, params.user_id]
      );
      return { success: true, message: 'Document created/updated' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  code_generate: async (params) => {
    // Generate code using LLM
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert software engineer. Write clean, production-ready code with comments.' },
          { role: 'user', content: params.prompt || params.requirements }
        ],
        max_tokens: 1500
      });
      return {
        success: true,
        code: completion.choices[0].message.content
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  query_database: async (params) => {
    // Execute SQL query with safety checks
    try {
      // Only allow SELECT queries for safety
      const sql = params.sql.trim();
      if (!sql.toUpperCase().startsWith('SELECT')) {
        return { success: false, error: 'Only SELECT queries allowed' };
      }
      const result = await pool.query(sql);
      return { success: true, rows: result.rows, rowCount: result.rowCount };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  analyze_data: async (params) => {
    // Analyze data using LLM
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a data analyst. Analyze data and provide insights.' },
          { role: 'user', content: `Analyze this data and answer: ${params.question}\n\nData: ${JSON.stringify(params.data)}` }
        ],
        max_tokens: 800
      });
      return {
        success: true,
        analysis: completion.choices[0].message.content
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  create_task: async (params) => {
    try {
      const priority = sanitizePriority(params.priority);
      const tag = sanitizeTag(params.tag);
      const taskCategory = sanitizeTaskCategory(params.task_category);
      const complexity = sanitizeComplexity(params.complexity);
      const estimatedHours = sanitizeEstimatedHours(params.estimated_hours);

      // Auto-route task to correct agent based on tag
      let assignedAgentId = null;
      if (tag) {
        const agentTypeMap = {
          engineering: 'engineering',
          browser: 'browser',
          research: 'research',
          growth: 'growth',
          data: 'data',
          support: 'support',
          content: 'content',
          twitter: 'twitter',
          outreach: 'outreach'
        };

        const agentType = agentTypeMap[tag];
        if (agentType) {
          const agentRes = await pool.query(
            'SELECT id FROM agents WHERE company_id = $1 AND type = $2 LIMIT 1',
            [params.company_id, agentType]
          );
          if (agentRes.rows[0]) {
            assignedAgentId = agentRes.rows[0].id;
          }
        }
      }

      const res = await pool.query(
        `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type, source)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10, $11, 'agent_generated') RETURNING id`,
        [params.company_id, params.title, params.description || '', assignedAgentId, priority,
         params.reasoning || 'Agent created task', tag, taskCategory,
         complexity, estimatedHours, params.task_type || 'task']
      );
      return { success: true, message: 'Task created', task_id: res.rows[0]?.id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  search_memory: async (params) => {
    // Search all 3 memory layers
    try {
      const results = [];

      // Search layer 1 (domain knowledge)
      const layer1Res = await pool.query(
        `SELECT 'layer1' as layer, 'domain_knowledge' as category, content, metadata FROM memory_layer1
         WHERE company_id = $1 AND content ILIKE $2
         ORDER BY accessed_count DESC, last_accessed_at DESC NULLS LAST
         LIMIT 3`,
        [params.company_id, `%${params.query}%`]
      );
      results.push(...layer1Res.rows);

      // Search layer 2 (preferences)
      const layer2Res = await pool.query(
        `SELECT 'layer2' as layer, 'preferences' as category, content, metadata FROM memory_layer2
         WHERE company_id = $1 AND content ILIKE $2
         ORDER BY accessed_count DESC, last_accessed_at DESC NULLS LAST
         LIMIT 2`,
        [params.company_id, `%${params.query}%`]
      );
      results.push(...layer2Res.rows);

      // Search layer 3 (cross-company patterns)
      const layer3Res = await pool.query(
        `SELECT 'layer3' as layer, 'patterns' as category, content, metadata FROM memory_layer3
         WHERE content ILIKE $1
         ORDER BY accessed_count DESC, last_accessed_at DESC NULLS LAST
         LIMIT 2`,
        [`%${params.query}%`]
      );
      results.push(...layer3Res.rows);

      return { success: true, results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  read_memory: async (params) => {
    // Read memory by layer
    try {
      let results = [];
      const layer = params.layer || 1;

      if (layer === 1 || layer === 'layer1' || layer === 'domain') {
        const res = await pool.query(
          'SELECT * FROM memory_layer1 WHERE company_id = $1 ORDER BY accessed_count DESC, updated_at DESC LIMIT 10',
          [params.company_id]
        );
        results.push(...res.rows);
      }

      if (layer === 2 || layer === 'layer2' || layer === 'preferences') {
        const res = await pool.query(
          'SELECT * FROM memory_layer2 WHERE company_id = $1 ORDER BY accessed_count DESC, updated_at DESC LIMIT 5',
          [params.company_id]
        );
        results.push(...res.rows);
      }

      if (layer === 3 || layer === 'layer3' || layer === 'patterns') {
        const res = await pool.query(
          'SELECT * FROM memory_layer3 ORDER BY accessed_count DESC, updated_at DESC LIMIT 5'
        );
        results.push(...res.rows);
      }

      return { success: true, results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  update_memory: async (params) => {
    // Update memory layer
    try {
      const layer = params.layer || 1;
      const metadata = params.metadata || {};

      if (layer === 1 || layer === 'layer1' || layer === 'domain') {
        await pool.query(
          `INSERT INTO memory_layer1 (company_id, content, metadata) VALUES ($1, $2, $3)`,
          [params.company_id, params.content, JSON.stringify(metadata)]
        );
      } else if (layer === 2 || layer === 'layer2' || layer === 'preferences') {
        await pool.query(
          `INSERT INTO memory_layer2 (company_id, content, metadata) VALUES ($1, $2, $3)`,
          [params.company_id, params.content, JSON.stringify(metadata)]
        );
      } else if (layer === 3 || layer === 'layer3' || layer === 'patterns') {
        // Layer 3 is cross-company, no company_id needed
        await pool.query(
          `INSERT INTO memory_layer3 (content, metadata) VALUES ($1, $2)`,
          [params.content, JSON.stringify(metadata)]
        );
      }

      return { success: true, message: 'Memory updated' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  get_company_documents: async (params) => {
    // Get all company documents
    try {
      const res = await pool.query('SELECT * FROM documents WHERE company_id = $1', [params.company_id]);
      return { success: true, documents: res.rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  update_document: async (params) => {
    // Update a company document
    try {
      await pool.query(
        `INSERT INTO documents (company_id, type, title, content, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, type) DO UPDATE SET content = $4, updated_at = NOW()`,
        [params.company_id, params.type, params.title, params.content, params.user_id]
      );
      return { success: true, message: 'Document updated' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  create_report: async (params) => {
    // Create a report
    try {
      await pool.query(
        `INSERT INTO reports (company_id, report_type, title, content, created_by_agent_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.company_id, params.type, params.title, JSON.stringify(params.content), params.agent_id]
      );
      return { success: true, message: 'Report created' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  create_learning: async (params) => {
    // Create a learning entry
    try {
      await pool.query(
        `INSERT INTO learnings (company_id, created_by_agent_id, content, tags)
         VALUES ($1, $2, $3, $4)`,
        [params.company_id, params.agent_id, params.content, params.tags || []]
      );
      return { success: true, message: 'Learning saved' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  search_learnings: async (params) => {
    // Search learnings
    try {
      const res = await pool.query(
        `SELECT * FROM learnings WHERE company_id = $1 AND content ILIKE $2
         ORDER BY created_at DESC LIMIT 10`,
        [params.company_id, `%${params.query}%`]
      );
      return { success: true, learnings: res.rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  create_skill: async (params) => {
    // Create a skill
    try {
      await pool.query(
        `INSERT INTO skills (skill_name, summary, content, keywords, agent_types)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (skill_name) DO UPDATE SET content = $3, updated_at = NOW()`,
        [params.skill_name, params.summary, params.content, params.keywords || [], params.agent_types || []]
      );
      return { success: true, message: 'Skill saved' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  search_skills: async (params) => {
    // Search skills
    try {
      const res = await pool.query(
        `SELECT * FROM skills WHERE
         to_tsvector('english', content || ' ' || COALESCE(summary, '') || ' ' || skill_name) @@ plainto_tsquery('english', $1)
         ORDER BY created_at DESC LIMIT 10`,
        [params.query]
      );
      return { success: true, skills: res.rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  get_inbox: async (params) => {
    // Get email inbox
    try {
      const res = await pool.query(
        `SELECT * FROM email_messages WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [params.company_id]
      );
      return { success: true, emails: res.rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  send_email: async (params) => {
    try {
      const fromEmail = params.from || 'noreply@runloop.app';
      // Try Postmark first
      const postmarkResult = await postmarkSend(fromEmail, params.to, params.subject, params.html_body || params.body, params.body);
      const sent = !postmarkResult.error;

      // Always log to DB
      await pool.query(
        `INSERT INTO email_messages (company_id, direction, from_email, to_email, subject, body, status)
         VALUES ($1, 'outbound', $2, $3, $4, $5, $6)`,
        [params.company_id, fromEmail, params.to, params.subject, params.body, sent ? 'sent' : 'failed']
      );
      if (!sent) return { success: false, error: postmarkResult.error };
      return { success: true, message: 'Email sent via Postmark', message_id: postmarkResult.MessageID };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  get_email_thread: async (params) => {
    // Get email thread
    try {
      const res = await pool.query(
        `SELECT * FROM email_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
        [params.thread_id]
      );
      return { success: true, thread: res.rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  add_contact: async (params) => {
    // Add contact to CRM
    try {
      await pool.query(
        `INSERT INTO contacts (company_id, email, name, company_name, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [params.company_id, params.email, params.name, params.company_name, params.notes]
      );
      return { success: true, message: 'Contact added' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  post_tweet: async (params) => {
    // Post tweet (log for now)
    try {
      await pool.query(
        `INSERT INTO reports (company_id, report_type, title, content)
         VALUES ($1, 'tweet', 'Tweet posted', $2)`,
        [params.company_id, JSON.stringify({ content: params.content })]
      );
      return { success: true, message: 'Tweet posted (logged)' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  find_email: async (params) => {
    try {
      const nameParts = (params.name || '').split(' ');
      const result = await hunterFind(params.domain, nameParts[0], nameParts.slice(1).join(' '));
      if (result.error) return { success: false, error: result.error };
      return { success: true, email: result.email, confidence: result.score, first_name: result.first_name, last_name: result.last_name };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  verify_email: async (params) => {
    try {
      const result = await hunterVerify(params.email);
      if (result.error) return { success: false, error: result.error };
      return { success: true, email: params.email, status: result.status, result: result.result, score: result.score };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  get_site_tier: async (params) => {
    // Get site tier for browser automation
    const tier1 = ['twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'];
    const tier15 = ['news.ycombinator.com', 'medium.com', 'dev.to'];
    const tier2 = ['hashnode.com', 'substack.com', 'betalist.com'];

    const domain = params.site.toLowerCase();
    if (tier1.some(d => domain.includes(d))) return { success: true, tier: 1 };
    if (tier15.some(d => domain.includes(d))) return { success: true, tier: 1.5 };
    if (tier2.some(d => domain.includes(d))) return { success: true, tier: 2 };
    return { success: true, tier: 3 };
  },

  get_site_credentials: async (params) => {
    // Get stored credentials for site
    try {
      const res = await pool.query(
        `SELECT * FROM site_credentials WHERE company_id = $1 AND site_domain = $2`,
        [params.company_id, params.site]
      );
      return { success: true, credentials: res.rows[0] || null };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  save_site_credentials: async (params) => {
    try {
      await pool.query(
        `INSERT INTO site_credentials (company_id, site_domain, username, password, tier)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, site_domain) DO UPDATE SET username = $3, password = $4, updated_at = NOW()`,
        [params.company_id, params.site, params.username, params.password, params.tier || 3]
      );
      return { success: true, message: 'Credentials saved' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ─── Additional Tool Handlers ──────────────────────────────────
  get_tasks: async (params) => {
    try {
      const status = params.status || null;
      let q = 'SELECT id, title, description, status, priority, assigned_agent_id, created_at FROM tasks WHERE company_id = $1';
      const p = [params.company_id];
      if (status) { q += ' AND status = $2'; p.push(status); }
      q += ' ORDER BY priority DESC, created_at DESC LIMIT 20';
      const res = await pool.query(q, p);
      return { success: true, tasks: res.rows };
    } catch (e) { return { success: false, error: e.message }; }
  },

  get_task_details: async (params) => {
    try {
      const res = await pool.query(
        `SELECT t.*, a.name as agent_name, e.status as exec_status, e.completed_at as exec_completed
         FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id
         LEFT JOIN executions e ON e.task_id = t.id
         WHERE t.id = $1 AND t.company_id = $2`,
        [params.task_id, params.company_id]
      );
      return { success: true, task: res.rows[0] || null };
    } catch (e) { return { success: false, error: e.message }; }
  },

  score_task: async (params) => {
    try {
      await pool.query(
        'UPDATE tasks SET score = $1, score_reasoning = $2 WHERE id = $3 AND company_id = $4',
        [params.score, params.reasoning || '', params.task_id, params.company_id]
      );
      return { success: true, message: 'Task scored' };
    } catch (e) { return { success: false, error: e.message }; }
  },

  query_reports: async (params) => {
    try {
      let q = 'SELECT id, report_type, title, created_at, created_by_agent_id FROM reports WHERE company_id = $1';
      const p = [params.company_id];
      if (params.type) { q += ' AND report_type = $2'; p.push(params.type); }
      q += ' ORDER BY created_at DESC LIMIT ' + (parseInt(params.limit) || 20);
      const res = await pool.query(q, p);
      return { success: true, reports: res.rows };
    } catch (e) { return { success: false, error: e.message }; }
  },

  get_overview: async (params) => {
    try {
      const [tasks, agents, execs, reports] = await Promise.all([
        pool.query('SELECT status, COUNT(*) as count FROM tasks WHERE company_id = $1 GROUP BY status', [params.company_id]),
        pool.query('SELECT COUNT(*) as count, SUM(tasks_completed) as total_completed FROM agents WHERE company_id = $1 AND is_active = true', [params.company_id]),
        pool.query('SELECT COUNT(*) as count FROM executions WHERE company_id = $1 AND created_at > NOW() - INTERVAL \'7 days\'', [params.company_id]),
        pool.query('SELECT COUNT(*) as count FROM reports WHERE company_id = $1 AND created_at > NOW() - INTERVAL \'7 days\'', [params.company_id])
      ]);
      return {
        success: true,
        overview: {
          tasks_by_status: Object.fromEntries(tasks.rows.map(r => [r.status, parseInt(r.count)])),
          active_agents: parseInt(agents.rows[0]?.count || 0),
          total_tasks_completed: parseInt(agents.rows[0]?.total_completed || 0),
          executions_this_week: parseInt(execs.rows[0]?.count || 0),
          reports_this_week: parseInt(reports.rows[0]?.count || 0)
        }
      };
    } catch (e) { return { success: false, error: e.message }; }
  },

  get_dashboard: async (params) => {
    try {
      const [stats, recentTasks, recentActivity] = await Promise.all([
        pool.query(`SELECT
          (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND status = 'completed') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND status IN ('todo', 'in_progress')) as pending_tasks,
          (SELECT COUNT(*) FROM agents WHERE company_id = $1 AND is_active = true) as active_agents,
          (SELECT COUNT(*) FROM executions WHERE company_id = $1 AND created_at > NOW() - INTERVAL '24 hours') as executions_today`, [params.company_id]),
        pool.query('SELECT id, title, status, priority FROM tasks WHERE company_id = $1 ORDER BY created_at DESC LIMIT 5', [params.company_id]),
        pool.query('SELECT type, title, description, created_at FROM activity_feed WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10', [params.company_id])
      ]);
      return { success: true, dashboard: { stats: stats.rows[0], recent_tasks: recentTasks.rows, recent_activity: recentActivity.rows } };
    } catch (e) { return { success: false, error: e.message }; }
  },

  add_link: async (params) => {
    try {
      const res = await pool.query(
        'INSERT INTO dashboard_links (company_id, title, url, icon, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [params.company_id, params.title, params.url, params.icon || '🔗', params.category || 'general']
      );
      return { success: true, link: res.rows[0] };
    } catch (e) { return { success: false, error: e.message }; }
  },

  get_contacts: async (params) => {
    try {
      const res = await pool.query(
        'SELECT * FROM contacts WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50',
        [params.company_id]
      );
      return { success: true, contacts: res.rows };
    } catch (e) { return { success: false, error: e.message }; }
  },

  update_lead_status: async (params) => {
    try {
      await pool.query(
        'UPDATE contacts SET lead_status = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3 AND company_id = $4',
        [params.status, params.notes, params.contact_id, params.company_id]
      );
      return { success: true, message: 'Lead status updated' };
    } catch (e) { return { success: false, error: e.message }; }
  },

  load_skill: async (params) => {
    try {
      const res = await pool.query('SELECT * FROM skills WHERE skill_name = $1', [params.skill_name]);
      if (!res.rows[0]) return { success: false, error: 'Skill not found' };
      await pool.query('UPDATE skills SET usage_count = COALESCE(usage_count, 0) + 1 WHERE skill_name = $1', [params.skill_name]);
      return { success: true, skill: res.rows[0] };
    } catch (e) { return { success: false, error: e.message }; }
  },

  update_skill: async (params) => {
    try {
      await pool.query(
        'UPDATE skills SET content = $1, summary = COALESCE($2, summary), updated_at = NOW() WHERE skill_name = $3',
        [params.content, params.summary, params.skill_name]
      );
      return { success: true, message: 'Skill updated' };
    } catch (e) { return { success: false, error: e.message }; }
  },

  // ─── Browser Tools (Browserbase) ──────────────────────────────────
  create_browser_session: async (params) => {
    try {
      const result = await browserbaiseCreateSession();
      if (result.error) return { success: false, error: result.error };
      return { success: true, session_id: result.id, connect_url: result.connectUrl };
    } catch (e) { return { success: false, error: e.message }; }
  },

  navigate: async (params) => {
    // Navigate using Browserbase Connect URL - simplified for tool usage
    return { success: true, message: `Navigation to ${params.url} queued. Use get_page_content to retrieve results.`, url: params.url };
  },

  get_page_content: async (params) => {
    // Fetch page content directly
    try {
      const resp = await fetch(params.url, {
        headers: { 'User-Agent': 'Runloop/1.0 (AI Agent)' },
        signal: AbortSignal.timeout(15000)
      });
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const html = await resp.text();
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 8000);
      return { success: true, content: text };
    } catch (e) { return { success: false, error: e.message }; }
  },

  close_browser_session: async (params) => {
    if (!hasApiKey('BROWSERBASE_API_KEY') || !params.session_id) return { success: true, message: 'Session closed' };
    try {
      await fetch(`https://www.browserbase.com/v1/sessions/${params.session_id}`, {
        method: 'DELETE',
        headers: { 'x-bb-api-key': process.env.BROWSERBASE_API_KEY }
      });
      return { success: true, message: 'Browser session closed' };
    } catch (e) { return { success: false, error: e.message }; }
  },

  // ─── Context Tool ──────────────────────────────────
  get_context: async (params) => {
    try {
      const [company, docs, tasks] = await Promise.all([
        pool.query('SELECT name, description, industry, size FROM companies WHERE id = $1', [params.company_id]),
        pool.query('SELECT type, content FROM documents WHERE company_id = $1', [params.company_id]),
        pool.query('SELECT id, title, status, priority FROM tasks WHERE company_id = $1 AND status IN (\'todo\', \'in_progress\') ORDER BY priority DESC LIMIT 10', [params.company_id])
      ]);
      return { success: true, company: company.rows[0], documents: docs.rows, pending_tasks: tasks.rows };
    } catch (e) { return { success: false, error: e.message }; }
  }
};

async function executeTool(toolName, params) {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { success: false, error: `Tool ${toolName} not found` };
  }

  try {
    return await handler(params);
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return { success: false, error: e.message };
  }
}

// ─── LLM Integration ──────────────────────────────────
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy',
  ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {})
});

// ─── External API Helpers ──────────────────────────────────
function hasApiKey(key) {
  return !!(process.env[key] && process.env[key].length > 5);
}

async function braveSearch(query, count = 5) {
  if (!hasApiKey('BRAVE_API_KEY')) return { error: 'Brave Search not configured. Add BRAVE_API_KEY in Settings → Integrations.' };
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': process.env.BRAVE_API_KEY } });
  if (!resp.ok) return { error: `Brave Search error: ${resp.status}` };
  const data = await resp.json();
  return (data.web?.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.description }));
}

async function postmarkSend(from, to, subject, htmlBody, textBody) {
  if (!hasApiKey('POSTMARK_API_KEY')) return { error: 'Postmark not configured. Add POSTMARK_API_KEY in Settings → Integrations.' };
  const resp = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY },
    body: JSON.stringify({ From: from, To: to, Subject: subject, HtmlBody: htmlBody || textBody, TextBody: textBody || htmlBody, MessageStream: 'outbound' })
  });
  if (!resp.ok) { const err = await resp.text(); return { error: `Postmark error: ${resp.status} - ${err}` }; }
  return await resp.json();
}

async function hunterFind(domain, firstName, lastName) {
  if (!hasApiKey('HUNTER_API_KEY')) return { error: 'Hunter.io not configured. Add HUNTER_API_KEY in Settings → Integrations.' };
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName || '')}&last_name=${encodeURIComponent(lastName || '')}&api_key=${process.env.HUNTER_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) return { error: `Hunter.io error: ${resp.status}` };
  const data = await resp.json();
  return data.data || {};
}

async function hunterVerify(email) {
  if (!hasApiKey('HUNTER_API_KEY')) return { error: 'Hunter.io not configured. Add HUNTER_API_KEY in Settings → Integrations.' };
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${process.env.HUNTER_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) return { error: `Hunter.io error: ${resp.status}` };
  const data = await resp.json();
  return data.data || {};
}

async function browserbaiseCreateSession() {
  if (!hasApiKey('BROWSERBASE_API_KEY')) return { error: 'Browserbase not configured. Add BROWSERBASE_API_KEY in Settings → Integrations.' };
  const resp = await fetch('https://www.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bb-api-key': process.env.BROWSERBASE_API_KEY },
    body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID || '' })
  });
  if (!resp.ok) return { error: `Browserbase error: ${resp.status}` };
  return await resp.json();
}

// Build OpenAI function definitions from tool registry — ALL tools
function buildToolDefinitions(agentType) {
  const allTools = [
    { name: 'create_task', description: 'Create a new task for another agent to execute', parameters: { type: 'object', properties: { title: { type: 'string', description: 'Task title' }, description: { type: 'string', description: 'Detailed task description' }, agent_id: { type: 'integer', description: 'Agent ID to assign' }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority level (default: medium)' }, tag: { type: 'string', enum: ['engineering', 'research', 'browser', 'growth', 'content', 'data', 'support', 'meta_ads'], description: 'Task category tag' }, complexity: { type: 'integer', description: 'Complexity 1-10 (default: 5)' } }, required: ['title', 'description'] } },
    { name: 'get_tasks', description: 'Get tasks for the company, optionally filtered by status', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status: todo, in_progress, completed, failed' } } } },
    { name: 'get_task_details', description: 'Get detailed info about a specific task', parameters: { type: 'object', properties: { task_id: { type: 'integer', description: 'Task ID' } }, required: ['task_id'] } },
    { name: 'score_task', description: 'Score a completed task (1-10) with reasoning', parameters: { type: 'object', properties: { task_id: { type: 'integer' }, score: { type: 'integer', description: '1-10 score' }, reasoning: { type: 'string' } }, required: ['task_id', 'score'] } },
    { name: 'search_memory', description: 'Search company memory across all layers (domain knowledge, preferences, patterns)', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
    { name: 'read_memory', description: 'Read full content from a specific memory layer (1=domain, 2=preferences, 3=patterns)', parameters: { type: 'object', properties: { layer: { type: 'integer', description: 'Memory layer: 1, 2, or 3' } }, required: ['layer'] } },
    { name: 'update_memory', description: 'Add new content to a memory layer', parameters: { type: 'object', properties: { layer: { type: 'integer', description: 'Memory layer: 1, 2, or 3' }, content: { type: 'string', description: 'Memory content to store' }, metadata: { type: 'object', description: 'Optional metadata' } }, required: ['layer', 'content'] } },
    { name: 'get_company_documents', description: 'Get all company documents (mission, product_overview, brand_voice, tech_notes, user_research)', parameters: { type: 'object', properties: {} } },
    { name: 'update_document', description: 'Create or update a company document', parameters: { type: 'object', properties: { type: { type: 'string', description: 'Document type: mission, product_overview, tech_notes, brand_voice, user_research' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['type', 'content'] } },
    { name: 'create_report', description: 'Create a structured report', parameters: { type: 'object', properties: { type: { type: 'string', description: 'Report type (research, analysis, status, etc)' }, title: { type: 'string' }, content: { type: 'object', description: 'Report content as JSON' } }, required: ['title', 'content'] } },
    { name: 'query_reports', description: 'Query existing reports, optionally filtered by type', parameters: { type: 'object', properties: { type: { type: 'string', description: 'Filter by report type' }, limit: { type: 'integer', description: 'Max results (default 20)' } } } },
    { name: 'create_learning', description: 'Save a learning/insight with tags', parameters: { type: 'object', properties: { content: { type: 'string', description: 'Learning content' }, tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' } }, required: ['content'] } },
    { name: 'search_learnings', description: 'Search saved learnings', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'search_skills', description: 'Search the skills library for procedures', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'load_skill', description: 'Load full content of a skill by name', parameters: { type: 'object', properties: { skill_name: { type: 'string' } }, required: ['skill_name'] } },
    { name: 'create_skill', description: 'Create a reusable skill procedure', parameters: { type: 'object', properties: { skill_name: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } }, agent_types: { type: 'array', items: { type: 'string' } } }, required: ['skill_name', 'summary', 'content'] } },
    { name: 'update_skill', description: 'Update an existing skill', parameters: { type: 'object', properties: { skill_name: { type: 'string' }, content: { type: 'string' }, summary: { type: 'string' } }, required: ['skill_name', 'content'] } },
    { name: 'web_search', description: 'Search the web using Brave Search API', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, count: { type: 'integer', description: 'Number of results (default 5)' } }, required: ['query'] } },
    { name: 'web_scrape', description: 'Fetch and extract text content from a URL', parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to scrape' } }, required: ['url'] } },
    { name: 'content_generate', description: 'Generate content (blog posts, social media, marketing copy)', parameters: { type: 'object', properties: { prompt: { type: 'string' }, type: { type: 'string', description: 'Content type (blog, tweet, email, etc)' }, tone: { type: 'string', description: 'Tone (professional, casual, witty, etc)' } }, required: ['prompt'] } },
    { name: 'summarize', description: 'Summarize text content', parameters: { type: 'object', properties: { text: { type: 'string', description: 'Text to summarize' }, max_length: { type: 'integer' } }, required: ['text'] } },
    { name: 'send_email', description: 'Send an email via Postmark', parameters: { type: 'object', properties: { to: { type: 'string', description: 'Recipient email' }, subject: { type: 'string' }, body: { type: 'string', description: 'Email body (plain text)' }, html_body: { type: 'string', description: 'HTML body (optional)' }, from: { type: 'string', description: 'Sender email (optional)' } }, required: ['to', 'subject', 'body'] } },
    { name: 'get_inbox', description: 'Get company email inbox (received + sent)', parameters: { type: 'object', properties: {} } },
    { name: 'get_email_thread', description: 'Get all messages in an email thread', parameters: { type: 'object', properties: { thread_id: { type: 'string' } }, required: ['thread_id'] } },
    { name: 'find_email', description: 'Find email address for a person at a domain using Hunter.io', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Person full name' }, domain: { type: 'string', description: 'Company domain' } }, required: ['name', 'domain'] } },
    { name: 'verify_email', description: 'Verify if an email address is valid using Hunter.io', parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
    { name: 'add_contact', description: 'Add a contact to CRM', parameters: { type: 'object', properties: { email: { type: 'string' }, name: { type: 'string' }, company_name: { type: 'string' }, notes: { type: 'string' } }, required: ['email'] } },
    { name: 'get_contacts', description: 'Get all company contacts', parameters: { type: 'object', properties: {} } },
    { name: 'update_lead_status', description: 'Update lead status on a contact', parameters: { type: 'object', properties: { contact_id: { type: 'integer' }, status: { type: 'string', description: 'Lead status (new, contacted, qualified, converted, lost)' }, notes: { type: 'string' } }, required: ['contact_id', 'status'] } },
    { name: 'get_overview', description: 'Get analytics overview (task stats, agent stats, execution counts)', parameters: { type: 'object', properties: {} } },
    { name: 'get_dashboard', description: 'Get dashboard summary (stats, recent tasks, activity)', parameters: { type: 'object', properties: {} } },
    { name: 'add_link', description: 'Add a link to the company dashboard', parameters: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, icon: { type: 'string' }, category: { type: 'string' } }, required: ['title', 'url'] } },
    { name: 'get_context', description: 'Get full company context (company info, documents, pending tasks)', parameters: { type: 'object', properties: {} } },
    { name: 'get_page_content', description: 'Fetch and extract text content from a web page', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'query_database', description: 'Execute a read-only SQL query (SELECT only)', parameters: { type: 'object', properties: { sql: { type: 'string', description: 'SQL SELECT query' } }, required: ['sql'] } },
    { name: 'analyze_data', description: 'Analyze data and provide insights using AI', parameters: { type: 'object', properties: { data: { type: 'object', description: 'Data to analyze' }, question: { type: 'string', description: 'Question about the data' } }, required: ['question'] } }
  ];

  return allTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

// ─── Memory & Document Context Injection ──────────────────────────────────
async function getCompanyContext(companyId) {
  try {
    const [memoryL1, memoryL2, docs] = await Promise.all([
      pool.query('SELECT content FROM memory_layer1 WHERE company_id = $1 ORDER BY accessed_count DESC, updated_at DESC NULLS LAST LIMIT 3', [companyId]),
      pool.query('SELECT content FROM memory_layer2 WHERE company_id = $1 LIMIT 1', [companyId]),
      pool.query('SELECT type, content FROM documents WHERE company_id = $1', [companyId])
    ]);

    let context = '';

    // Inject memory
    if (memoryL1.rows.length > 0 || memoryL2.rows.length > 0) {
      context += '\n\n## Company Memory\n';
      if (memoryL2.rows[0]) context += `**Preferences:** ${memoryL2.rows[0].content.substring(0, 500)}\n`;
      for (const m of memoryL1.rows) {
        context += `**Knowledge:** ${m.content.substring(0, 300)}\n`;
      }
    }

    // Inject documents
    if (docs.rows.length > 0) {
      context += '\n\n## Company Documents\n';
      for (const doc of docs.rows) {
        const label = doc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        context += `**${label}:** ${doc.content.substring(0, 400)}\n`;
      }
    }

    return context;
  } catch (e) {
    console.error('Error loading company context:', e);
    return '';
  }
}

// ─── Conversation Auto-Save to Memory ──────────────────────────────────
async function maybeAutoSaveMemory(conversationId, companyId) {
  try {
    // Check message count since last save
    const convRes = await pool.query(
      'SELECT message_count, last_memory_save_at FROM conversations WHERE id = $1',
      [conversationId]
    );
    const conv = convRes.rows[0];
    if (!conv) return;

    const msgCount = parseInt(conv.message_count) || 0;

    // Get messages since last save
    let query = 'SELECT role, content FROM messages WHERE conversation_id = $1';
    const params = [conversationId];
    if (conv.last_memory_save_at) {
      query += ' AND created_at > $2';
      params.push(conv.last_memory_save_at);
    }
    query += ' ORDER BY created_at ASC';

    const messagesRes = await pool.query(query, params);
    if (messagesRes.rows.length < 20) return; // Only auto-save every 20 messages

    // Summarize the conversation using LLM
    const conversationText = messagesRes.rows.map(m => `${m.role}: ${m.content}`).join('\n').substring(0, 3000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Extract 2-4 key facts, decisions, or preferences from this conversation. Be concise. Return as bullet points.' },
        { role: 'user', content: conversationText }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const summary = completion.choices[0]?.message?.content;
    if (summary) {
      await pool.query(
        'INSERT INTO memory_layer1 (company_id, content, metadata) VALUES ($1, $2, $3)',
        [companyId, summary, JSON.stringify({ source: 'conversation_auto_save', conversation_id: conversationId })]
      );

      // Update last_memory_save_at
      await pool.query(
        'UPDATE conversations SET last_memory_save_at = NOW() WHERE id = $1',
        [conversationId]
      );

      console.log(`💾 Auto-saved memory from conversation ${conversationId}`);
    }
  } catch (e) {
    console.error('Memory auto-save error:', e);
  }
}

async function generateAgentResponse(agent, userMessage, conversationId, companyId) {
  try {
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];

    const historyRes = await pool.query(
      'SELECT role, content, tool_calls FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversationId]
    );
    const history = historyRes.rows.reverse();

    let systemPrompt = agent.system_prompt || 'You are a helpful AI assistant.';
    if (company) {
      systemPrompt = systemPrompt.replace('{{company_name}}', company.name).replace('{{current_date}}', new Date().toISOString().split('T')[0]);
      systemPrompt += `\n\nYou are working for ${company.name}. `;
      if (company.description) systemPrompt += `Company description: ${company.description}. `;
      if (company.industry) systemPrompt += `Industry: ${company.industry}. `;
    }

    const companyContext = await getCompanyContext(companyId);
    systemPrompt += companyContext;
    systemPrompt += '\n\nYou are part of an autonomous AI team. Be concise, actionable, and professional. If a task requires another agent\'s expertise, use the create_task tool. Current date: ' + new Date().toISOString().split('T')[0];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => {
        const msg = { role: m.role, content: m.content || '' };
        if (m.tool_calls && typeof m.tool_calls === 'string') {
          try {
            const parsed = JSON.parse(m.tool_calls);
            if (parsed.length > 0) {
              // Ensure each tool_call has type: "function" (OpenAI requires this)
              msg.tool_calls = parsed.map(tc => ({ ...tc, type: tc.type || 'function' }));
            }
          } catch {}
        }
        return msg;
      }),
      { role: 'user', content: userMessage }
    ];

    const tools = buildToolDefinitions(agent.type);
    let allToolResults = [];
    let totalTokens = 0;
    const maxIterations = 10;

    // Multi-turn tool-calling loop
    for (let i = 0; i < maxIterations; i++) {
      const completion = await openai.chat.completions.create({
        model: agent.model || 'gpt-4o',
        messages,
        tools,
        temperature: agent.temperature || 0.7,
        max_tokens: 1500
      });

      const responseMessage = completion.choices[0].message;
      totalTokens += completion.usage?.total_tokens || 0;

      // No tool calls = final text response
      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        return {
          content: responseMessage.content || 'Done.',
          tool_calls: [],
          tool_results: allToolResults,
          tokens_used: totalTokens
        };
      }

      // Process tool calls
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch {}
        args.company_id = companyId;
        args.agent_id = agent.id;

        const result = await executeTool(toolName, args);
        allToolResults.push({ tool: toolName, args, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    // If we hit max iterations, return last content
    return {
      content: 'I completed multiple tool operations. Let me know if you need anything else.',
      tool_calls: [],
      tool_results: allToolResults,
      tokens_used: totalTokens
    };
  } catch (e) {
    console.error('LLM generation error:', e);
    return {
      content: `I'm having trouble connecting to my AI systems. Error: ${e.message}. Please try again.`,
      tool_calls: [],
      tool_results: [],
      tokens_used: 0
    };
  }
}

// ─── Chat API ──────────────────────────────────
// Get all conversations for user
app.get('/api/chat/conversations', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, a.name as agent_name, a.icon as agent_icon,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
       FROM conversations c
       LEFT JOIN agents a ON c.agent_id = a.id
       WHERE c.company_id = $1
       ORDER BY c.updated_at DESC`,
      [req.user.company_id]
    );
    res.json({ conversations: result.rows });
  } catch (e) {
    console.error('Get conversations error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new conversation
app.post('/api/chat/conversations', apiAuth, async (req, res) => {
  try {
    const { agent_id, title } = req.body;
    const result = await pool.query(
      `INSERT INTO conversations (company_id, user_id, agent_id, title)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.company_id, req.user.id, agent_id || null, title || 'New conversation']
    );
    res.json({ conversation: result.rows[0] });
  } catch (e) {
    console.error('Create conversation error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete conversation
app.delete('/api/chat/conversations/:id', apiAuth, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    // Verify ownership
    const checkRes = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND company_id = $2',
      [convId, req.user.company_id]
    );
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    // Delete messages first (cascade)
    await pool.query('DELETE FROM messages WHERE conversation_id = $1', [convId]);
    // Delete conversation
    await pool.query('DELETE FROM conversations WHERE id = $1', [convId]);
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (e) {
    console.error('Delete conversation error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a conversation
app.get('/api/chat/conversations/:id/messages', apiAuth, async (req, res) => {
  try {
    const conversationRes = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!conversationRes.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ messages: messages.rows });
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message and get AI response
app.post('/api/chat/conversations/:id/messages', apiAuth, async (req, res) => {
  try {
    const { message, agent_id } = req.body;
    const conversationId = parseInt(req.params.id);

    // Verify conversation belongs to user's company
    const conversationRes = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND company_id = $2',
      [conversationId, req.user.company_id]
    );
    if (!conversationRes.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

    // Save user message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversationId, 'user', message]
    );

    // Update conversation updated_at
    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    // Determine which agent should respond
    let targetAgentId = agent_id;
    if (!targetAgentId) {
      // Use conversation's default agent or route based on message
      if (conversationRes.rows[0].agent_id) {
        targetAgentId = conversationRes.rows[0].agent_id;
      } else {
        targetAgentId = await routeTask(message, req.user.company_id);
      }
    }

    // Get agent details
    const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [targetAgentId]);
    const agent = agentRes.rows[0];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Generate AI response using LLM
    const aiResponse = await generateAgentResponse(agent, message, conversationId, req.user.company_id);

    // Save agent message
    const agentMsgRes = await pool.query(
      `INSERT INTO messages (conversation_id, role, content, agent_id, tool_calls, metadata, token_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [conversationId, 'assistant', aiResponse.content, agent.id,
       JSON.stringify(aiResponse.tool_calls || []),
       JSON.stringify(aiResponse.tool_results || []),
       aiResponse.tokens_used || 0]
    );

    // Update message count on conversation
    await pool.query('UPDATE conversations SET message_count = COALESCE(message_count, 0) + 2, updated_at = NOW() WHERE id = $1', [conversationId]);

    // Trigger auto-save to memory (runs in background, non-blocking)
    maybeAutoSaveMemory(conversationId, req.user.company_id).catch(() => {});

    res.json({ reply: agentMsgRes.rows[0], tool_results: aiResponse.tool_results });
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// ─── Streaming Chat Endpoint (SSE) ──────────────────────────────────
app.get('/api/chat/conversations/:id/stream', apiAuth, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const message = req.query.message;
    const agentIdParam = req.query.agent_id;

    if (!message) return res.status(400).json({ error: 'Message required' });

    const conversationRes = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND company_id = $2',
      [conversationId, req.user.company_id]
    );
    if (!conversationRes.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

    // Save user message
    await pool.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [conversationId, 'user', message]);
    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    // Determine agent
    let targetAgentId = agentIdParam ? parseInt(agentIdParam) : null;
    if (!targetAgentId) {
      targetAgentId = conversationRes.rows[0].agent_id || await routeTask(message, req.user.company_id);
    }
    const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [targetAgentId]);
    const agent = agentRes.rows[0];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Build context
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    const company = companyRes.rows[0];
    const historyRes = await pool.query(
      'SELECT role, content, tool_calls FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversationId]
    );
    const history = historyRes.rows.reverse();

    let systemPrompt = agent.system_prompt || 'You are a helpful AI assistant.';
    if (company) {
      systemPrompt = systemPrompt.replace('{{company_name}}', company.name).replace('{{current_date}}', new Date().toISOString().split('T')[0]);
      systemPrompt += `\n\nYou are working for ${company.name}.`;
      if (company.description) systemPrompt += ` ${company.description}`;
    }
    const companyContext = await getCompanyContext(req.user.company_id);
    systemPrompt += companyContext;
    systemPrompt += '\n\nCurrent date: ' + new Date().toISOString().split('T')[0];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => {
        const msg = { role: m.role, content: m.content || '' };
        if (m.tool_calls && typeof m.tool_calls === 'string') {
          try {
            const parsed = JSON.parse(m.tool_calls);
            if (parsed.length > 0) {
              // Ensure each tool_call has type: "function" (OpenAI requires this)
              msg.tool_calls = parsed.map(tc => ({ ...tc, type: tc.type || 'function' }));
            }
          } catch {}
        }
        return msg;
      }),
      { role: 'user', content: message }
    ];

    const tools = buildToolDefinitions(agent.type);
    let fullContent = '';
    let allToolResults = [];
    let totalTokens = 0;

    // Multi-turn streaming loop
    for (let turn = 0; turn < 10; turn++) {
      const stream = await openai.chat.completions.create({
        model: agent.model || 'gpt-4o',
        messages,
        tools,
        temperature: agent.temperature || 0.7,
        max_tokens: 1500,
        stream: true
      });

      let currentContent = '';
      let currentToolCalls = [];
      let finishReason = null;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        finishReason = chunk.choices?.[0]?.finish_reason;

        if (delta?.content) {
          currentContent += delta.content;
          fullContent += delta.content;
          res.write(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!currentToolCalls[tc.index]) {
                currentToolCalls[tc.index] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) currentToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        if (chunk.usage) totalTokens += chunk.usage.total_tokens || 0;
      }

      // If no tool calls, we're done streaming
      if (finishReason !== 'tool_calls' || currentToolCalls.length === 0) {
        break;
      }

      // Execute tool calls
      const assistantMsg = { role: 'assistant', content: currentContent || null, tool_calls: currentToolCalls };
      messages.push(assistantMsg);

      res.write(`data: ${JSON.stringify({ type: 'tool_start', tools: currentToolCalls.map(tc => tc.function.name) })}\n\n`);

      for (const toolCall of currentToolCalls) {
        const toolName = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch {}
        args.company_id = req.user.company_id;
        args.agent_id = agent.id;

        // Emit per-tool start event
        res.write(`data: ${JSON.stringify({ type: 'tool_call_start', tool: toolName, timestamp: Date.now() })}\n\n`);

        const toolStartTime = Date.now();
        const result = await executeTool(toolName, args);
        const toolDuration = Date.now() - toolStartTime;
        allToolResults.push({ tool: toolName, result, duration_ms: toolDuration });

        // Emit per-tool end event with summary
        const resultStr = JSON.stringify(result);
        res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolName, result: resultStr.substring(0, 200), duration_ms: toolDuration, success: result?.success !== false })}\n\n`);

        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultStr });
      }

      // Emit thinking event before next LLM turn
      if (turn < 9) {
        res.write(`data: ${JSON.stringify({ type: 'agent_thinking', timestamp: Date.now() })}\n\n`);
      }
    }

    // Save assistant message to DB
    await pool.query(
      `INSERT INTO messages (conversation_id, role, content, agent_id, tool_calls, metadata, token_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [conversationId, 'assistant', fullContent || 'Tool operations completed.',
       agent.id, JSON.stringify([]), JSON.stringify(allToolResults), totalTokens]
    );
    await pool.query('UPDATE conversations SET message_count = COALESCE(message_count, 0) + 2, updated_at = NOW() WHERE id = $1', [conversationId]);

    // Trigger memory auto-save
    maybeAutoSaveMemory(conversationId, req.user.company_id).catch(() => {});

    res.write(`data: ${JSON.stringify({ type: 'done', tokens: totalTokens })}\n\n`);
    res.end();
  } catch (e) {
    console.error('Stream chat error:', e);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
      res.end();
    } catch {}
  }
});

// ─── Email Inbound Webhook ──────────────────────────────────
app.post('/api/email/inbound', async (req, res) => {
  try {
    const { From, To, Subject, TextBody, HtmlBody, MessageID, Date: emailDate } = req.body;

    // Find company by recipient email
    const toEmail = (To || '').toLowerCase();
    // Try to match company slug from email
    const slugMatch = toEmail.match(/^([^@]+)@/);
    let companyId = null;

    if (slugMatch) {
      const compRes = await pool.query('SELECT id FROM companies WHERE slug = $1', [slugMatch[1]]);
      if (compRes.rows[0]) companyId = compRes.rows[0].id;
    }

    if (!companyId) {
      // Try to find by any matching email in contacts
      const contactRes = await pool.query('SELECT company_id FROM contacts WHERE email = $1 LIMIT 1', [From]);
      if (contactRes.rows[0]) companyId = contactRes.rows[0].company_id;
    }

    if (!companyId) {
      console.log('Inbound email: no matching company for', To);
      return res.json({ success: true, message: 'No matching company' });
    }

    // Generate thread_id from subject
    const threadSubject = (Subject || '').replace(/^(Re:|Fwd?:)\s*/gi, '').trim();
    const threadId = crypto.createHash('md5').update(threadSubject.toLowerCase()).digest('hex').substring(0, 16);

    await pool.query(
      `INSERT INTO email_messages (company_id, direction, from_email, to_email, subject, body, thread_id, external_id)
       VALUES ($1, 'inbound', $2, $3, $4, $5, $6, $7)`,
      [companyId, From, To, Subject, TextBody || HtmlBody, threadId, MessageID]
    );

    // Add sender as contact if not exists
    await pool.query(
      `INSERT INTO contacts (company_id, email, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [companyId, From, From.split('@')[0]]
    );

    console.log(`📧 Inbound email from ${From} to ${To} (company ${companyId})`);
    res.json({ success: true });
  } catch (e) {
    console.error('Inbound email error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Documents API ──────────────────────────────────
app.get('/api/documents', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM documents WHERE company_id = $1 ORDER BY type, created_at DESC',
      [req.user.company_id]
    );
    res.json({ documents: result.rows });
  } catch (e) {
    console.error('Get documents error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get document by type
app.get('/api/documents/:type', apiAuth, async (req, res) => {
  try {
    const validTypes = ['mission', 'product_overview', 'tech_notes', 'brand_voice', 'user_research'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }
    const result = await pool.query(
      'SELECT * FROM documents WHERE company_id = $1 AND type = $2',
      [req.user.company_id, req.params.type]
    );
    res.json({ document: result.rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
app.post('/api/documents', apiAuth, async (req, res) => {
  try {
    const { type, title, content } = req.body;
    const result = await pool.query(
      `INSERT INTO documents (company_id, type, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id, type) DO UPDATE SET content = $3, updated_at = NOW()
       RETURNING *`,
      [req.user.company_id, type, content]
    );
    res.json({ document: result.rows[0] });
  } catch (e) {
    console.error('Create document error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document by type
app.put('/api/documents/:type', apiAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const validTypes = ['mission', 'product_overview', 'tech_notes', 'brand_voice', 'user_research'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const result = await pool.query(
      `INSERT INTO documents (company_id, type, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id, type) DO UPDATE SET content = $3, updated_at = NOW()
       RETURNING *`,
      [req.user.company_id, req.params.type, content]
    );
    res.json({ document: result.rows[0] });
  } catch (e) {
    console.error('Update document error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Settings API ──────────────────────────────────
app.put('/api/settings/profile', apiAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name',
      [name, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (e) {
    console.error('Update profile error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.put('/api/settings/company', apiAuth, async (req, res) => {
  try {
    const { name, description, industry, size } = req.body;
    const result = await pool.query(
      'UPDATE companies SET name = COALESCE($1, name), description = COALESCE($2, description), industry = COALESCE($3, industry), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, description, industry, req.user.company_id]
    );
    res.json({ company: result.rows[0] });
  } catch (e) {
    console.error('Update company error:', e);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

app.post('/api/settings/api-keys', apiAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const rawKey = 'rl_' + crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 10) + '...';

    await pool.query(
      'INSERT INTO api_keys (user_id, company_id, name, key_hash, prefix) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, req.user.company_id, name || 'API Key', keyHash, prefix]
    );

    res.json({ key: rawKey, prefix, name: name || 'API Key' });
  } catch (e) {
    console.error('Create API key error:', e);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

app.get('/api/settings/api-keys', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, prefix, last_used_at, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ keys: result.rows });
  } catch (e) {
    console.error('Get API keys error:', e);
    res.json({ keys: [] });
  }
});

app.delete('/api/settings/api-keys/:id', apiAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete API key error:', e);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// ─── Integrations Status API ──────────────────────────────────
app.get('/api/settings/integrations', apiAuth, async (req, res) => {
  const integrations = [
    { name: 'OpenAI (GPT-4o)', key: 'OPENAI_API_KEY', icon: '🤖', description: 'LLM for all agent conversations and task execution', connected: hasApiKey('OPENAI_API_KEY') },
    { name: 'Brave Search', key: 'BRAVE_API_KEY', icon: '🔍', description: 'Web search for research and information gathering', connected: hasApiKey('BRAVE_API_KEY') },
    { name: 'Postmark', key: 'POSTMARK_API_KEY', icon: '📧', description: 'Email sending and receiving', connected: hasApiKey('POSTMARK_API_KEY') },
    { name: 'Hunter.io', key: 'HUNTER_API_KEY', icon: '🎯', description: 'Email finding and verification for outreach', connected: hasApiKey('HUNTER_API_KEY') },
    { name: 'Browserbase', key: 'BROWSERBASE_API_KEY', icon: '🌐', description: 'Browser automation for web tasks', connected: hasApiKey('BROWSERBASE_API_KEY') },
    { name: 'Redis', key: 'REDIS_URL', icon: '⚡', description: 'Caching and job queue', connected: hasApiKey('REDIS_URL') },
    { name: 'Gemini', key: 'GEMINI_API_KEY', icon: '💎', description: 'Google Gemini AI (backup)', connected: hasApiKey('GEMINI_API_KEY') },
    { name: 'Database', key: 'DATABASE_URL', icon: '🗄️', description: 'PostgreSQL database', connected: hasApiKey('DATABASE_URL') }
  ];
  res.json({ integrations, connected_count: integrations.filter(i => i.connected).length, total: integrations.length });
});

// ─── Cycle Config API ──────────────────────────────────
app.get('/api/settings/cycle', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT cycles_enabled, cycle_time, cycle_frequency FROM companies WHERE id = $1',
      [req.user.company_id]
    );
    res.json({ config: result.rows[0] || { cycles_enabled: true, cycle_time: '02:00', cycle_frequency: 'daily' } });
  } catch (e) {
    res.json({ config: { cycles_enabled: true, cycle_time: '02:00', cycle_frequency: 'daily' } });
  }
});

app.put('/api/settings/cycle', apiAuth, async (req, res) => {
  try {
    const { cycles_enabled, cycle_time, cycle_frequency } = req.body;
    await pool.query(
      'UPDATE companies SET cycles_enabled = $1, cycle_time = $2, cycle_frequency = $3 WHERE id = $4',
      [cycles_enabled !== false, cycle_time || '02:00', cycle_frequency || 'daily', req.user.company_id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Manual Cycle Trigger ──────────────────────────────────
app.post('/api/cycles/trigger', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];

    const [docs, pending, memL1] = await Promise.all([
      pool.query('SELECT type, content FROM documents WHERE company_id = $1', [companyId]),
      pool.query('SELECT id, title, status, priority FROM tasks WHERE company_id = $1 AND status IN (\'todo\', \'in_progress\') LIMIT 10', [companyId]),
      pool.query('SELECT content FROM memory_layer1 WHERE company_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 3', [companyId])
    ]);

    const planPrompt = `You are the CEO agent planning a work cycle for ${company.name}.
Documents: ${docs.rows.map(d => `${d.type}: ${(d.content || '').substring(0, 200)}`).join('\n')}
Pending tasks: ${pending.rows.map(t => `[${t.priority}] ${t.title} (${t.status})`).join('\n') || 'None'}
Memory: ${memL1.rows.map(m => (m.content || '').substring(0, 200)).join('\n') || 'None'}

Plan 2-4 high-impact tasks. Return as JSON:
{ "tasks": [{ "title": "...", "description": "...", "agent_type": "...", "priority": 5 }], "reasoning": "..." }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You plan work cycles. Return only valid JSON.' },
        { role: 'user', content: planPrompt }
      ],
      temperature: 0.7, max_tokens: 1000
    });

    const plan = JSON.parse(completion.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

    const cycleRes = await pool.query(
      `INSERT INTO cycles (company_id, planned_at, status, planned_tasks, plan_reasoning)
       VALUES ($1, NOW(), 'executing', $2, $3) RETURNING id`,
      [companyId, JSON.stringify(plan.tasks || []), plan.reasoning || '']
    );

    let created = 0;
    for (const task of (plan.tasks || [])) {
      const agentRes = await pool.query(
        'SELECT id FROM agents WHERE company_id = $1 AND type = $2 AND is_active = true LIMIT 1',
        [companyId, task.agent_type || 'ceo']
      );
      const agentId = agentRes.rows[0]?.id;
      if (agentId) {
        await pool.query(
          `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type, source)
           VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10, 'task', 'cycle')`,
          [companyId, task.title, task.description || '', agentId, sanitizePriority(task.priority),
           task.reasoning || 'Cycle planned task', sanitizeTag(task.tag), sanitizeTaskCategory(task.category),
           sanitizeComplexity(task.complexity), sanitizeEstimatedHours(task.estimated_hours)]
        );
        created++;
      }
    }

    await pool.query('UPDATE cycles SET tasks_created = $1, started_at = NOW() WHERE id = $2', [created, cycleRes.rows[0].id]);

    res.json({ success: true, cycle_id: cycleRes.rows[0].id, tasks_created: created, reasoning: plan.reasoning });
  } catch (e) {
    console.error('Manual cycle trigger error:', e);
    res.status(500).json({ error: 'Cycle planning failed: ' + e.message });
  }
});

// ─── Reports API ──────────────────────────────────
app.get('/api/reports', apiAuth, async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    let query = 'SELECT r.*, a.name as agent_name FROM reports r LEFT JOIN agents a ON r.created_by_agent_id = a.id WHERE r.company_id = $1';
    const params = [req.user.company_id];

    if (type) {
      query += ' AND r.report_type = $2';
      params.push(type);
      query += ' ORDER BY r.created_at DESC LIMIT $3';
      params.push(parseInt(limit));
    } else {
      query += ' ORDER BY r.created_at DESC LIMIT $2';
      params.push(parseInt(limit));
    }

    const result = await pool.query(query, params);
    res.json({ reports: result.rows });
  } catch (e) {
    console.error('Get reports error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reports', apiAuth, async (req, res) => {
  try {
    const { report_type, title, content, agent_id } = req.body;
    const result = await pool.query(
      `INSERT INTO reports (company_id, report_type, title, content, created_by_agent_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.company_id, report_type, title, JSON.stringify(content), agent_id]
    );
    res.json({ report: result.rows[0] });
  } catch (e) {
    console.error('Create report error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reports/:id', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json({ report: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Skills API ──────────────────────────────────
app.get('/api/skills', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM skills ORDER BY created_at DESC'
    );
    res.json({ skills: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/skills/search', apiAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ skills: [] });

    const result = await pool.query(
      `SELECT * FROM skills WHERE
       to_tsvector('english', content || ' ' || COALESCE(summary, '') || ' ' || skill_name) @@ plainto_tsquery('english', $1)
       ORDER BY created_at DESC LIMIT 20`,
      [q]
    );
    res.json({ skills: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/skills', apiAuth, async (req, res) => {
  try {
    const { skill_name, summary, content, keywords, agent_types } = req.body;
    const result = await pool.query(
      `INSERT INTO skills (skill_name, summary, content, keywords, agent_types)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [skill_name, summary, content, keywords || [], agent_types || []]
    );
    res.json({ skill: result.rows[0] });
  } catch (e) {
    console.error('Create skill error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/skills/:name', apiAuth, async (req, res) => {
  try {
    const { summary, content, keywords, agent_types } = req.body;
    const result = await pool.query(
      `UPDATE skills SET summary = $1, content = $2, keywords = $3, agent_types = $4, updated_at = NOW()
       WHERE skill_name = $5 RETURNING *`,
      [summary, content, keywords, agent_types, req.params.name]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Skill not found' });
    res.json({ skill: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Learnings API ──────────────────────────────────
app.get('/api/learnings', apiAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(
      `SELECT l.*, a.name as agent_name FROM learnings l
       LEFT JOIN agents a ON l.created_by_agent_id = a.id
       WHERE l.company_id = $1
       ORDER BY l.created_at DESC LIMIT $2`,
      [req.user.company_id, parseInt(limit)]
    );
    res.json({ learnings: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/learnings/search', apiAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ learnings: [] });

    const result = await pool.query(
      `SELECT * FROM learnings WHERE company_id = $1 AND
       to_tsvector('english', content) @@ plainto_tsquery('english', $2)
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.company_id, q]
    );
    res.json({ learnings: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/learnings', apiAuth, async (req, res) => {
  try {
    const { content, tags, agent_id } = req.body;
    const result = await pool.query(
      `INSERT INTO learnings (company_id, created_by_agent_id, content, tags)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.company_id, agent_id, content, tags || []]
    );
    res.json({ learning: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Email API ──────────────────────────────────
app.get('/api/email/inbox', apiAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(
      `SELECT * FROM email_messages WHERE company_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [req.user.company_id, parseInt(limit)]
    );
    res.json({ emails: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/email/send', apiAuth, async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    // Attempt to send via Postmark
    let sendStatus = 'failed';
    let errorMessage = null;
    let isSandboxError = false;

    try {
      const sendResult = await postmarkSend(
        req.user.email,
        to,
        subject,
        body,
        body.replace(/<[^>]*>/g, '') // strip HTML for text version
      );

      if (sendResult.error) {
        errorMessage = sendResult.error;
        // Check if it's a sandbox mode error
        if (sendResult.error.includes('sandbox') || sendResult.error.includes('406')) {
          isSandboxError = true;
        }
      } else {
        sendStatus = 'sent';
      }
    } catch (sendError) {
      errorMessage = sendError.message;
    }

    // Save email to database regardless of send status
    const result = await pool.query(
      `INSERT INTO email_messages (company_id, direction, from_email, to_email, subject, body, status)
       VALUES ($1, 'outbound', $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.company_id, req.user.email, to, subject, body, sendStatus]
    );

    // Return response with sandbox warning if applicable
    if (sendStatus === 'failed') {
      if (isSandboxError) {
        return res.json({
          success: true,
          email: result.rows[0],
          warning: 'Email saved but not sent: Postmark is in SANDBOX mode. Only test emails to verified addresses will be delivered. To send real emails, activate your Postmark account.',
          sandbox_mode: true
        });
      }
      return res.json({
        success: true,
        email: result.rows[0],
        warning: `Email saved but delivery failed: ${errorMessage}`,
        send_error: true
      });
    }

    res.json({ success: true, email: result.rows[0], sent: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/email/contacts', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE company_id = $1 ORDER BY created_at DESC',
      [req.user.company_id]
    );
    res.json({ contacts: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/email/contacts', apiAuth, async (req, res) => {
  try {
    const { email, name, company_name, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO contacts (company_id, email, name, company_name, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.company_id, email, name, company_name, notes]
    );
    res.json({ contact: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Recurring Tasks API ──────────────────────────────────
app.get('/api/recurring-tasks', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM recurring_tasks WHERE company_id = $1 ORDER BY created_at DESC',
      [req.user.company_id]
    );
    res.json({ recurring_tasks: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/recurring-tasks', apiAuth, async (req, res) => {
  try {
    const { title, description, agent_id, frequency, days, day_of_month, time_of_day, priority } = req.body;
    const template = JSON.stringify({ description, agent_id, days, day_of_month, time_of_day, priority: priority || 'medium' });
    const result = await pool.query(
      `INSERT INTO recurring_tasks (company_id, title, template, frequency)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.company_id, title, template, frequency]
    );
    res.json({ recurring_task: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/recurring-tasks/:id', apiAuth, async (req, res) => {
  try {
    const { is_active, enabled, title, description, frequency, days, day_of_month, priority } = req.body;
    const activeVal = enabled !== undefined ? enabled : is_active;

    const updates = [];
    const vals = [];
    let idx = 1;
    if (activeVal !== undefined) { updates.push(`enabled = $${idx++}`); vals.push(activeVal); }
    if (title) { updates.push(`title = $${idx++}`); vals.push(title); }
    if (frequency) { updates.push(`frequency = $${idx++}`); vals.push(frequency); }

    // Update template JSONB for nested fields
    if (description !== undefined || days !== undefined || day_of_month !== undefined || priority) {
      const templateUpdates = {};
      if (description !== undefined) templateUpdates.description = description;
      if (days !== undefined) templateUpdates.days = days;
      if (day_of_month !== undefined) templateUpdates.day_of_month = day_of_month;
      if (priority) templateUpdates.priority = priority;
      updates.push(`template = COALESCE(template, '{}'::jsonb) || $${idx++}::jsonb`);
      vals.push(JSON.stringify(templateUpdates));
    }
    updates.push('updated_at = NOW()');

    vals.push(req.params.id, req.user.company_id);
    const result = await pool.query(
      `UPDATE recurring_tasks SET ${updates.join(', ')} WHERE id = $${idx++} AND company_id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recurring task not found' });
    res.json({ recurring_task: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/recurring-tasks/:id', apiAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM recurring_tasks WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Workflows API ──────────────────────────────────
app.get('/api/workflows', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workflows WHERE company_id = $1 ORDER BY created_at DESC',
      [req.user.company_id]
    );
    res.json({ workflows: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/workflows', apiAuth, async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config, steps } = req.body;
    const result = await pool.query(
      `INSERT INTO workflows (company_id, name, description, trigger_type, trigger_config, steps, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.company_id, name, description, trigger_type, JSON.stringify(trigger_config), JSON.stringify(steps), req.user.id]
    );
    res.json({ workflow: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/workflows/:id/run', apiAuth, async (req, res) => {
  try {
    const workflowRes = await pool.query(
      'SELECT * FROM workflows WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!workflowRes.rows[0]) return res.status(404).json({ error: 'Workflow not found' });

    const result = await pool.query(
      `INSERT INTO workflow_runs (workflow_id, company_id, status)
       VALUES ($1, $2, 'running') RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    res.json({ workflow_run: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Workflow Runs History ──────────────────────────────────
app.get('/api/workflows/:id/runs', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM workflow_runs WHERE workflow_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id, req.user.company_id]
    );
    res.json({ runs: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/workflows/:id', apiAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM workflow_runs WHERE workflow_id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    await pool.query('DELETE FROM workflows WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Analytics API ──────────────────────────────────
app.get('/api/analytics/overview', apiAuth, async (req, res) => {
  try {
    const [tasks, agents, executions, todayTasks] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM tasks WHERE company_id = $1`, [req.user.company_id]),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM agents WHERE company_id = $1`, [req.user.company_id]),
      pool.query(`
        SELECT COALESCE(AVG(duration_seconds), 0) as avg_duration
        FROM executions WHERE company_id = $1`, [req.user.company_id]),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE status = 'completed') as completed_today
        FROM tasks WHERE company_id = $1 AND created_at::date = CURRENT_DATE`, [req.user.company_id])
    ]);

    res.json({
      total_completed: parseInt(tasks.rows[0].completed) || 0,
      total_failed: parseInt(tasks.rows[0].failed) || 0,
      completed_today: parseInt(todayTasks.rows[0].completed_today) || 0,
      avg_duration: parseFloat(executions.rows[0].avg_duration) || 0,
      active_agents: parseInt(agents.rows[0].active) || 0,
      total_agents: parseInt(agents.rows[0].total) || 0
    });
  } catch (e) {
    console.error('Analytics overview error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/analytics/agents', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id, a.name, a.type, a.icon,
        COALESCE(a.tasks_completed, 0) as tasks_completed,
        COALESCE(a.tasks_failed, 0) as tasks_failed,
        COALESCE(AVG(e.duration_seconds), 0) as avg_duration
      FROM agents a
      LEFT JOIN executions e ON e.agent_id = a.id AND e.status = 'completed'
      WHERE a.company_id = $1
      GROUP BY a.id
      ORDER BY a.tasks_completed DESC NULLS LAST
    `, [req.user.company_id]);
    res.json({ agents: result.rows });
  } catch (e) {
    console.error('Analytics agents error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/analytics/tasks', apiAuth, async (req, res) => {
  try {
    const [daily, byType] = await Promise.all([
      pool.query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM tasks
        WHERE company_id = $1 AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [req.user.company_id]),
      pool.query(`
        SELECT task_type as type, COUNT(*) as count
        FROM tasks WHERE company_id = $1
        GROUP BY task_type ORDER BY count DESC
      `, [req.user.company_id])
    ]);
    res.json({ daily: daily.rows, by_type: byType.rows });
  } catch (e) {
    console.error('Analytics tasks error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Capabilities API ──────────────────────────────────
app.get('/api/capabilities/agents', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, type, description, is_active
       FROM agents WHERE company_id = $1 ORDER BY name`,
      [req.user.company_id]
    );
    res.json({ agents: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/capabilities/tools', apiAuth, async (req, res) => {
  try {
    // Return all available tools
    const tools = Object.keys(toolHandlers).map(name => ({
      name,
      description: `Tool: ${name}`,
      available: true
    }));
    res.json({ tools });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Dashboard API ──────────────────────────────────
app.get('/api/dashboard', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.json({ stats: {}, agents: [], recent_tasks: [], activity: [] });

    const [stats, agents, recentTasks, activity] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM agents WHERE company_id = $1 AND is_active = true) as active_agents,
          (SELECT COUNT(*) FROM tasks WHERE company_id = $1) as total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND status = 'completed') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE company_id = $1 AND status = 'in_progress') as running_tasks
      `, [companyId]),
      pool.query('SELECT * FROM agents WHERE company_id = $1 ORDER BY name', [companyId]),
      pool.query(`
        SELECT t.*, a.name as agent_name, a.icon as agent_icon
        FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id
        WHERE t.company_id = $1
        ORDER BY t.created_at DESC LIMIT 10
      `, [companyId]),
      pool.query(`
        SELECT af.*, a.name as agent_name, a.icon as agent_icon
        FROM activity_feed af LEFT JOIN agents a ON af.agent_id = a.id
        WHERE af.company_id = $1
        ORDER BY af.created_at DESC LIMIT 20
      `, [companyId])
    ]);

    res.json({
      stats: stats.rows[0],
      agents: agents.rows,
      recent_tasks: recentTasks.rows,
      activity: activity.rows
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/dashboard/links', apiAuth, async (req, res) => {
  try {
    const { title, url } = req.body;
    const result = await pool.query(
      'INSERT INTO dashboard_links (company_id, title, url) VALUES ($1, $2, $3) RETURNING *',
      [req.user.company_id, title, url]
    );
    res.json({ link: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/dashboard/links', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dashboard_links WHERE company_id = $1 ORDER BY created_at DESC',
      [req.user.company_id]
    );
    res.json({ links: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/dashboard/links/:id', apiAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM dashboard_links WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Memory API ──────────────────────────────────
app.get('/api/memory/search', apiAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });

    const results = [];

    // Search layer 1 (domain knowledge)
    const layer1Res = await pool.query(
      `SELECT 'layer1' as layer, metadata, content, created_at FROM memory_layer1
       WHERE company_id = $1 AND content ILIKE $2 ORDER BY accessed_count DESC, updated_at DESC LIMIT 5`,
      [req.user.company_id, `%${q}%`]
    );
    results.push(...layer1Res.rows);

    // Search layer 2 (preferences)
    const layer2Res = await pool.query(
      `SELECT 'layer2' as layer, metadata, content, created_at FROM memory_layer2
       WHERE company_id = $1 AND content ILIKE $2 ORDER BY accessed_count DESC, updated_at DESC LIMIT 3`,
      [req.user.company_id, `%${q}%`]
    );
    results.push(...layer2Res.rows);

    // Search layer 3 (patterns)
    const layer3Res = await pool.query(
      `SELECT 'layer3' as layer, metadata, content, created_at FROM memory_layer3
       WHERE content ILIKE $1 ORDER BY accessed_count DESC, updated_at DESC LIMIT 2`,
      [`%${q}%`]
    );
    results.push(...layer3Res.rows);

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST-based memory search (body parameters)
app.post('/api/memory/search', apiAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json({ results: [] });

    const results = [];
    const searchTerm = `%${query}%`;

    const [l1, l2, l3] = await Promise.all([
      pool.query('SELECT \'layer1\' as layer, \'domain_knowledge\' as category, content, metadata, created_at FROM memory_layer1 WHERE company_id = $1 AND content ILIKE $2 ORDER BY accessed_count DESC LIMIT 5', [req.user.company_id, searchTerm]),
      pool.query('SELECT \'layer2\' as layer, \'preferences\' as category, content, metadata, created_at FROM memory_layer2 WHERE company_id = $1 AND content ILIKE $2 ORDER BY updated_at DESC LIMIT 3', [req.user.company_id, searchTerm]),
      pool.query('SELECT \'layer3\' as layer, \'patterns\' as category, content, metadata, created_at FROM memory_layer3 WHERE content ILIKE $1 ORDER BY updated_at DESC LIMIT 2', [searchTerm])
    ]);

    results.push(...l1.rows, ...l2.rows, ...l3.rows);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/memory/:layer', apiAuth, async (req, res) => {
  try {
    const { layer } = req.params;
    let result;

    if (layer === '1' || layer === 'layer1' || layer === 'domain') {
      result = await pool.query('SELECT * FROM memory_layer1 WHERE company_id = $1 ORDER BY accessed_count DESC, updated_at DESC NULLS LAST', [req.user.company_id]);
    } else if (layer === '2' || layer === 'layer2' || layer === 'preferences') {
      result = await pool.query('SELECT * FROM memory_layer2 WHERE company_id = $1 ORDER BY updated_at DESC NULLS LAST', [req.user.company_id]);
    } else if (layer === '3' || layer === 'layer3' || layer === 'patterns') {
      result = await pool.query('SELECT * FROM memory_layer3 ORDER BY updated_at DESC NULLS LAST');
    } else {
      return res.status(400).json({ error: 'Invalid layer. Use 1, 2, or 3' });
    }

    res.json({ memory: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update memory layer
app.put('/api/memory/:layer', apiAuth, async (req, res) => {
  try {
    const { layer } = req.params;
    const { content, metadata } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    if (layer === '1') {
      const result = await pool.query(
        'INSERT INTO memory_layer1 (company_id, content, metadata) VALUES ($1, $2, $3) RETURNING *',
        [req.user.company_id, content, JSON.stringify(metadata || {})]
      );
      res.json({ memory: result.rows[0] });
    } else if (layer === '2') {
      // Layer 2 is unique per company — upsert
      const existing = await pool.query('SELECT id FROM memory_layer2 WHERE company_id = $1', [req.user.company_id]);
      let result;
      if (existing.rows[0]) {
        result = await pool.query(
          'UPDATE memory_layer2 SET content = $1, metadata = $2, updated_at = NOW() WHERE company_id = $3 RETURNING *',
          [content, JSON.stringify(metadata || {}), req.user.company_id]
        );
      } else {
        result = await pool.query(
          'INSERT INTO memory_layer2 (company_id, content, metadata) VALUES ($1, $2, $3) RETURNING *',
          [req.user.company_id, content, JSON.stringify(metadata || {})]
        );
      }
      res.json({ memory: result.rows[0] });
    } else if (layer === '3') {
      const result = await pool.query(
        'INSERT INTO memory_layer3 (content, metadata) VALUES ($1, $2) RETURNING *',
        [content, JSON.stringify(metadata || {})]
      );
      res.json({ memory: result.rows[0] });
    } else {
      return res.status(400).json({ error: 'Invalid layer' });
    }
  } catch (e) {
    console.error('Memory update error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete memory entry
app.delete('/api/memory/:layer/:id', apiAuth, async (req, res) => {
  try {
    const { layer, id } = req.params;
    const table = layer === '1' ? 'memory_layer1' : layer === '2' ? 'memory_layer2' : layer === '3' ? 'memory_layer3' : null;
    if (!table) return res.status(400).json({ error: 'Invalid layer' });

    if (layer === '3') {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM ${table} WHERE id = $1 AND company_id = $2`, [id, req.user.company_id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Cycle Engine API ──────────────────────────────────
app.get('/api/cycles/context', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [company, docs, pendingTasks, memoryL1, memoryL2, recentExecs] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [companyId]),
      pool.query('SELECT type, content FROM documents WHERE company_id = $1', [companyId]),
      pool.query('SELECT id, title, description, priority, status FROM tasks WHERE company_id = $1 AND status IN (\'todo\', \'in_progress\') ORDER BY priority DESC LIMIT 20', [companyId]),
      pool.query('SELECT content FROM memory_layer1 WHERE company_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 5', [companyId]),
      pool.query('SELECT content FROM memory_layer2 WHERE company_id = $1 LIMIT 1', [companyId]),
      pool.query('SELECT e.status, t.title, e.completed_at FROM executions e JOIN tasks t ON e.task_id = t.id WHERE e.company_id = $1 ORDER BY e.completed_at DESC NULLS LAST LIMIT 10', [companyId])
    ]);

    res.json({
      context: {
        company: company.rows[0],
        documents: docs.rows,
        pending_tasks: pendingTasks.rows,
        memory: { layer1: memoryL1.rows, layer2: memoryL2.rows },
        recent_executions: recentExecs.rows
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/cycles/plan', apiAuth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { planned_tasks, plan_reasoning } = req.body;

    const result = await pool.query(
      `INSERT INTO cycles (company_id, planned_at, status, planned_tasks, plan_reasoning)
       VALUES ($1, NOW(), 'planning', $2, $3) RETURNING *`,
      [companyId, JSON.stringify(planned_tasks || []), plan_reasoning || '']
    );

    res.json({ cycle: result.rows[0] });
  } catch (e) {
    console.error('Cycle plan error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/cycles/plan/:id', apiAuth, async (req, res) => {
  try {
    const { planned_tasks, plan_reasoning } = req.body;
    const result = await pool.query(
      `UPDATE cycles SET planned_tasks = $1, plan_reasoning = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4 RETURNING *`,
      [JSON.stringify(planned_tasks || []), plan_reasoning, req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cycle not found' });
    res.json({ cycle: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Execute a cycle
app.post('/api/cycles/:id/execute', apiAuth, async (req, res) => {
  try {
    const cycleRes = await pool.query(
      'SELECT * FROM cycles WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!cycleRes.rows[0]) return res.status(404).json({ error: 'Cycle not found' });

    const cycle = cycleRes.rows[0];
    const plannedTasks = cycle.planned_tasks || [];

    // Update cycle status
    await pool.query('UPDATE cycles SET status = $1, started_at = NOW() WHERE id = $2', ['executing', cycle.id]);

    // Create tasks from plan
    let tasksCreated = 0;
    for (const planned of plannedTasks) {
      try {
        const agentRes = await pool.query(
          'SELECT id FROM agents WHERE company_id = $1 AND type = $2 AND is_active = true LIMIT 1',
          [req.user.company_id, planned.agent_type || 'ceo']
        );
        const agentId = agentRes.rows[0]?.id;

        await pool.query(
          `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type, source)
           VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10, 'task', 'cycle')`,
          [req.user.company_id, planned.title, planned.description || '', agentId, sanitizePriority(planned.priority),
           planned.reasoning || 'Manual cycle trigger', sanitizeTag(planned.tag), sanitizeTaskCategory(planned.category),
           sanitizeComplexity(planned.complexity), sanitizeEstimatedHours(planned.estimated_hours)]
        );
        tasksCreated++;
      } catch (e) {
        console.error('Cycle task creation error:', e);
      }
    }

    await pool.query('UPDATE cycles SET tasks_created = $1 WHERE id = $2', [tasksCreated, cycle.id]);

    res.json({ success: true, tasks_created: tasksCreated });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit cycle review
app.post('/api/cycles/:id/review', apiAuth, async (req, res) => {
  try {
    const { review_summary, accomplished, failed, blocked, tomorrow_priorities } = req.body;

    const result = await pool.query(
      `UPDATE cycles SET
        status = 'completed', completed_at = NOW(),
        review_summary = $1, accomplished = $2, failed = $3, blocked = $4, tomorrow_priorities = $5,
        updated_at = NOW()
       WHERE id = $6 AND company_id = $7 RETURNING *`,
      [
        review_summary,
        JSON.stringify(accomplished || []),
        JSON.stringify(failed || []),
        JSON.stringify(blocked || []),
        JSON.stringify(tomorrow_priorities || []),
        req.params.id, req.user.company_id
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Cycle not found' });

    // Increment cycles_completed on company
    await pool.query('UPDATE companies SET cycles_completed = COALESCE(cycles_completed, 0) + 1 WHERE id = $1', [req.user.company_id]);

    res.json({ cycle: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// List past cycles
app.get('/api/cycles', apiAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const result = await pool.query(
      'SELECT * FROM cycles WHERE company_id = $1 ORDER BY planned_at DESC LIMIT $2',
      [req.user.company_id, parseInt(limit)]
    );
    res.json({ cycles: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get latest cycle
app.get('/api/cycles/latest', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cycles WHERE company_id = $1 ORDER BY planned_at DESC LIMIT 1',
      [req.user.company_id]
    );
    res.json({ cycle: result.rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Nightly Cycle Scheduler ──────────────────────────────────
async function runNightlyCycleCheck() {
  try {
    // Find companies where it's cycle time
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    // Use safe column access with COALESCE for companies that may not have cycle fields
    const companies = await pool.query(
      `SELECT id, name, COALESCE(cycle_time, '02:00') as cycle_time FROM companies
       WHERE COALESCE(cycles_enabled, true) = true AND status = 'active'
       AND COALESCE(cycle_time, '02:00') = $1`,
      [timeStr]
    );

    for (const company of companies.rows) {
      // Check if we already ran a cycle today
      const existingCycle = await pool.query(
        `SELECT id FROM cycles WHERE company_id = $1 AND planned_at::date = CURRENT_DATE`,
        [company.id]
      );
      if (existingCycle.rows.length > 0) continue;

      console.log(`🌙 Running nightly cycle for company ${company.id}: ${company.name}`);

      // Get context for CEO agent to plan
      const [docs, pending, memL1] = await Promise.all([
        pool.query('SELECT type, content FROM documents WHERE company_id = $1', [company.id]),
        pool.query('SELECT id, title, status, priority FROM tasks WHERE company_id = $1 AND status IN (\'todo\', \'in_progress\') LIMIT 10', [company.id]),
        pool.query('SELECT content FROM memory_layer1 WHERE company_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 3', [company.id])
      ]);

      // Create a cycle plan using CEO agent
      try {
        const planPrompt = `You are the CEO agent planning tonight's autonomous work cycle.

Company: ${company.name}
Documents: ${docs.rows.map(d => `${d.type}: ${d.content.substring(0, 200)}`).join('\n')}
Pending tasks: ${pending.rows.map(t => `[${t.priority}] ${t.title} (${t.status})`).join('\n') || 'None'}
Memory: ${memL1.rows.map(m => m.content.substring(0, 200)).join('\n') || 'None'}

Plan 2-4 tasks for tonight. Focus on high-impact work. Return as JSON:
{ "tasks": [{ "title": "...", "description": "...", "agent_type": "...", "priority": 5 }], "reasoning": "..." }`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You plan nightly work cycles. Return only valid JSON.' },
            { role: 'user', content: planPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        const plan = JSON.parse(completion.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

        // Create cycle record
        const cycleRes = await pool.query(
          `INSERT INTO cycles (company_id, planned_at, status, planned_tasks, plan_reasoning)
           VALUES ($1, NOW(), 'executing', $2, $3) RETURNING id`,
          [company.id, JSON.stringify(plan.tasks || []), plan.reasoning || '']
        );

        // Create and queue tasks
        let created = 0;
        for (const task of (plan.tasks || [])) {
          const agentRes = await pool.query(
            'SELECT id FROM agents WHERE company_id = $1 AND type = $2 AND is_active = true LIMIT 1',
            [company.id, task.agent_type || 'ceo']
          );
          const agentId = agentRes.rows[0]?.id;
          if (agentId) {
            await pool.query(
              `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type, source)
               VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10, 'task', 'cycle')`,
              [company.id, task.title, task.description || '', agentId, sanitizePriority(task.priority),
               task.reasoning || 'Nightly cycle planned task', sanitizeTag(task.tag), sanitizeTaskCategory(task.category),
               sanitizeComplexity(task.complexity), sanitizeEstimatedHours(task.estimated_hours)]
            );
            created++;
          }
        }

        await pool.query('UPDATE cycles SET tasks_created = $1, started_at = NOW() WHERE id = $2', [created, cycleRes.rows[0].id]);

        console.log(`✅ Nightly cycle created for ${company.name}: ${created} tasks`);
      } catch (e) {
        console.error(`Cycle planning error for company ${company.id}:`, e);
      }
    }
  } catch (e) {
    console.error('Nightly cycle check error:', e);
  }
}

// Run cycle check every minute via node-cron
cron.schedule('* * * * *', runNightlyCycleCheck);
console.log('✓ Nightly cycle scheduler started (checks every minute)');

// ─── Recurring Tasks Scheduler ──────────────────────────────────
async function runRecurringTaskScheduler() {
  try {
    // Find recurring tasks that need to run
    const now = new Date();
    const tasks = await pool.query(
      `SELECT rt.*, c.name as company_name FROM recurring_tasks rt
       JOIN companies c ON rt.company_id = c.id
       WHERE rt.enabled = true
       AND (rt.next_run_at IS NULL OR rt.next_run_at <= $1)
       LIMIT 10`,
      [now]
    );

    for (const rt of tasks.rows) {
      // Check if should run today based on frequency
      const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
      const dayOfMonth = now.getUTCDate();

      let shouldRun = false;
      const tmpl = rt.template || {};
      if (rt.frequency === 'daily') shouldRun = true;
      else if (rt.frequency === 'weekdays') shouldRun = dayOfWeek >= 1 && dayOfWeek <= 5;
      else if (rt.frequency === 'weekly') {
        const rtDays = rt.days || tmpl.days || [];
        const daysArr = Array.isArray(rtDays) ? rtDays : [];
        shouldRun = daysArr.includes(dayOfWeek);
      }
      else if (rt.frequency === 'monthly') {
        const dom = rt.day_of_month || tmpl.day_of_month;
        shouldRun = dom ? dayOfMonth === parseInt(dom) : false;
      }

      if (!shouldRun) {
        // Calculate next run
        await calculateNextRun(rt);
        continue;
      }

      // Check if already ran today
      const existingRun = await pool.query(
        `SELECT id FROM recurring_task_runs WHERE recurring_task_id = $1 AND created_at::date = CURRENT_DATE`,
        [rt.id]
      );
      if (existingRun.rows.length > 0) continue;

      console.log(`🔄 Creating recurring task instance: ${rt.title}`);

      // Create task instance - handle both schema versions
      const template = rt.template || {};
      const taskTitle = rt.title || template.title || 'Recurring task';
      const taskDesc = rt.description || template.description || '';
      const taskAgentId = rt.agent_id || template.agent_id || null;
      const taskPriority = sanitizePriority(rt.priority || template.priority);

      const taskRes = await pool.query(
        `INSERT INTO tasks (company_id, title, description, assigned_agent_id, priority, status, suggestion_reasoning, tag, task_category, executability_type, complexity, estimated_hours, task_type, source)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, 'can_run_now', $9, $10, 'task', 'agent_generated') RETURNING id`,
        [rt.company_id, taskTitle, taskDesc, taskAgentId, taskPriority,
         'Recurring task scheduled execution', sanitizeTag(rt.tag), sanitizeTaskCategory(rt.task_category),
         sanitizeComplexity(rt.complexity), sanitizeEstimatedHours(rt.estimated_hours)]
      );

      // Track the run
      await pool.query(
        'INSERT INTO recurring_task_runs (recurring_task_id, task_id, status) VALUES ($1, $2, $3)',
        [rt.id, taskRes.rows[0].id, 'created']
      );

      // Update last_run_at and calculate next_run
      await pool.query(
        'UPDATE recurring_tasks SET last_run_at = NOW() WHERE id = $1',
        [rt.id]
      );

      await calculateNextRun(rt);
    }
  } catch (e) {
    console.error('Recurring task scheduler error:', e);
  }
}

async function calculateNextRun(rt) {
  const now = new Date();
  let nextRun = new Date(now);

  if (rt.frequency === 'daily') {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  } else if (rt.frequency === 'weekdays') {
    do { nextRun.setUTCDate(nextRun.getUTCDate() + 1); }
    while (nextRun.getUTCDay() === 0 || nextRun.getUTCDay() === 6);
  } else if (rt.frequency === 'weekly') {
    nextRun.setUTCDate(nextRun.getUTCDate() + 7);
  } else if (rt.frequency === 'monthly') {
    nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
  }

  // Set to time_of_day if available
  if (rt.time_of_day) {
    const [h, m] = rt.time_of_day.split(':');
    nextRun.setUTCHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
  } else {
    nextRun.setUTCHours(9, 0, 0, 0); // Default 9am UTC
  }

  await pool.query('UPDATE recurring_tasks SET next_run_at = $1 WHERE id = $2', [nextRun, rt.id]);
}

// Run recurring task scheduler every minute via cron
cron.schedule('* * * * *', runRecurringTaskScheduler);
setTimeout(runRecurringTaskScheduler, 10000); // Run once on startup
console.log('✓ Recurring task scheduler started (checks every minute)');

// Enhanced recurring tasks with run history
app.get('/api/recurring-tasks/:id/runs', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rtr.*, t.title as task_title, t.status as task_status
       FROM recurring_task_runs rtr
       LEFT JOIN tasks t ON rtr.task_id = t.id
       WHERE rtr.recurring_task_id = $1
       ORDER BY rtr.created_at DESC LIMIT 30`,
      [req.params.id]
    );
    res.json({ runs: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Enhanced Skills API ──────────────────────────────────
// Get skill by name
app.get('/api/skills/:name', apiAuth, async (req, res) => {
  try {
    // Skip "search" route to avoid conflict
    if (req.params.name === 'search') return;

    const result = await pool.query(
      'SELECT * FROM skills WHERE skill_name = $1',
      [req.params.name]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Skill not found' });

    // Increment usage count
    await pool.query('UPDATE skills SET usage_count = COALESCE(usage_count, 0) + 1 WHERE skill_name = $1', [req.params.name]);

    res.json({ skill: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Enhanced Learnings API ──────────────────────────────────
// Get learnings by tag
app.get('/api/learnings/tags/:tag', apiAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, a.name as agent_name FROM learnings l
       LEFT JOIN agents a ON l.created_by_agent_id = a.id
       WHERE l.company_id = $1 AND $2 = ANY(l.tags)
       ORDER BY l.created_at DESC LIMIT 50`,
      [req.user.company_id, req.params.tag]
    );
    res.json({ learnings: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Task Router ──────────────────────────────────
async function routeTask(text, companyId) {
  const lower = text.toLowerCase();
  const keywords = {
    engineering: ['code', 'bug', 'deploy', 'fix', 'build', 'api', 'database', 'server', 'test', 'implement', 'refactor'],
    research: ['research', 'analyze', 'report', 'competitor', 'market', 'survey', 'study', 'investigate'],
    growth: ['marketing', 'content', 'blog', 'social', 'campaign', 'growth', 'email campaign', 'newsletter', 'seo'],
    sales: ['lead', 'prospect', 'outreach', 'sales', 'demo', 'pipeline', 'crm', 'cold email'],
    operations: ['monitor', 'schedule', 'backup', 'maintain', 'sync', 'alert', 'infrastructure', 'ops'],
    support: ['ticket', 'support', 'help', 'customer', 'faq', 'knowledge base', 'respond']
  };

  let bestType = 'engineering';
  let bestScore = 0;

  for (const [type, words] of Object.entries(keywords)) {
    const score = words.filter(w => lower.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestType = type; }
  }

  const agentRes = await pool.query(
    'SELECT id FROM agents WHERE company_id = $1 AND type = $2 AND is_active = true LIMIT 1',
    [companyId, bestType]
  );

  if (agentRes.rows[0]) return agentRes.rows[0].id;

  // Fallback to any active agent
  const fallback = await pool.query(
    'SELECT id FROM agents WHERE company_id = $1 AND is_active = true LIMIT 1',
    [companyId]
  );
  return fallback.rows[0]?.id || null;
}

// ─── Execution Simulator ──────────────────────────────────
// ─── Real Task Execution Engine ──────────────────────────────────
async function executeTask(taskId, executionId, agentId, companyId) {
  const startTime = Date.now();
  const steps = [];
  let totalTokens = 0;

  try {
    // Update status
    await pool.query('UPDATE tasks SET status = $1, started_at = NOW() WHERE id = $2', ['in_progress', taskId]);
    await pool.query('UPDATE agents SET last_run_at = NOW() WHERE id = $1', [agentId]);

    // Get task and agent details
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskRes.rows[0];

    const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
    const agent = agentRes.rows[0];

    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];

    // Log start
    steps.push({ step: 'Task started', status: 'completed', timestamp: new Date().toISOString() });
    await pool.query(
      'UPDATE executions SET steps = $1, logs = logs || $2::jsonb WHERE id = $3',
      [JSON.stringify(steps), JSON.stringify([`[${new Date().toISOString()}] Starting task: ${task.title}`]), executionId]
    );

    // Build system prompt with company context + memory + documents
    let systemPrompt = agent.system_prompt || 'You are a helpful AI assistant.';
    if (company) {
      systemPrompt += `\n\nYou are working for ${company.name}.`;
      if (company.description) systemPrompt += ` ${company.description}`;
      if (company.industry) systemPrompt += ` Industry: ${company.industry}.`;
    }

    // Inject memory and documents
    const companyContext = await getCompanyContext(companyId);
    systemPrompt += companyContext;

    // Multi-turn LLM + Tools execution loop
    let messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${task.title}\n\n${task.description || ''}` }
    ];

    const tools = buildToolDefinitions();
    let conversationHistory = [];
    const maxTurns = agent.max_turns || 10;

    for (let turn = 0; turn < maxTurns; turn++) {
      steps.push({ step: `AI turn ${turn + 1}`, status: 'running', timestamp: new Date().toISOString() });
      await pool.query(
        'UPDATE executions SET steps = $1, logs = logs || $2::jsonb WHERE id = $3',
        [JSON.stringify(steps), JSON.stringify([`[${new Date().toISOString()}] Turn ${turn + 1}: Calling AI...`]), executionId]
      );

      const completion = await openai.chat.completions.create({
        model: agent.model || 'gpt-4o',
        messages,
        tools,
        temperature: agent.temperature || 0.7,
        max_tokens: 1500
      });

      const responseMessage = completion.choices[0].message;
      totalTokens += completion.usage?.total_tokens || 0;

      conversationHistory.push(responseMessage.content || '(tool calls)');
      steps[steps.length - 1].status = 'completed';

      // If no tool calls, we're done
      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        steps.push({ step: 'Task completed', status: 'completed', timestamp: new Date().toISOString() });
        break;
      }

      // Execute tool calls
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {}

        args.company_id = companyId;
        args.agent_id = agentId;

        steps.push({ step: `Tool: ${toolName}`, status: 'running', timestamp: new Date().toISOString() });
        await pool.query(
          'UPDATE executions SET logs = logs || $1::jsonb WHERE id = $2',
          [JSON.stringify([`[${new Date().toISOString()}] Executing tool: ${toolName}`]), executionId]
        );

        const toolResult = await executeTool(toolName, args);

        steps[steps.length - 1].status = 'completed';
        steps[steps.length - 1].result = JSON.stringify(toolResult).substring(0, 100);

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      await pool.query(
        'UPDATE executions SET steps = $1 WHERE id = $2',
        [JSON.stringify(steps), executionId]
      );
    }

    // Store result
    const result = {
      summary: conversationHistory.join('\n\n'),
      turns: conversationHistory.length,
      agent: agent.name,
      company: company.name,
      tokens: totalTokens
    };

    const durationMs = Date.now() - startTime;

    const durationSec = Math.round(durationMs / 1000);
    await pool.query(
      'UPDATE executions SET status = $1, completed_at = NOW(), duration_seconds = $2, tokens_used = $3 WHERE id = $4',
      ['completed', durationSec, totalTokens, executionId]
    );
    await pool.query(
      'UPDATE tasks SET status = $1, completed_at = NOW(), completion_summary = $2 WHERE id = $3',
      ['completed', typeof result === 'string' ? result : JSON.stringify(result), taskId]
    );
    await pool.query(
      'UPDATE agents SET tasks_completed = COALESCE(tasks_completed, 0) + 1, last_run_at = NOW() WHERE id = $1',
      [agentId]
    );

    // Activity feed
    await pool.query(
      `INSERT INTO activity_feed (company_id, agent_id, task_id, execution_id, type, title, description)
       VALUES ($1, $2, $3, $4, 'task_completed', $5, $6)`,
      [companyId, agentId, taskId, executionId,
       `${agent.name} completed: ${task.title}`,
       `Completed in ${(durationMs / 1000).toFixed(1)}s using ${totalTokens} tokens`]
    );

    console.log(`✓ Task ${taskId} completed in ${durationMs}ms`);

  } catch (e) {
    console.error('Task execution error:', e);
    try {
      // Check retry count
      const taskCheck = await pool.query('SELECT retry_count FROM tasks WHERE id = $1', [taskId]);
      const retryCount = parseInt(taskCheck.rows[0]?.retry_count || 0);

      if (retryCount < 3) {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
        console.log(`⟳ Retrying task ${taskId} (attempt ${retryCount + 1}/3) in ${delay}ms`);
        await pool.query('UPDATE tasks SET retry_count = $1, status = \'todo\' WHERE id = $2', [retryCount + 1, taskId]);
        await pool.query('UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2', ['failed', executionId]);
        setTimeout(() => autonomousWorker(), delay);
      } else {
        await pool.query('UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2', ['failed', executionId]);
        await pool.query('UPDATE tasks SET status = $1, failure_reason = $2, failed_at = NOW() WHERE id = $3', ['failed', e.message, taskId]);
        await pool.query('UPDATE agents SET tasks_failed = COALESCE(tasks_failed, 0) + 1 WHERE id = $1', [agentId]);
      }
    } catch {}
  }
}

// Alias for backward compatibility
const simulateExecution = executeTask;

// ─── Autonomous Task Worker ──────────────────────────────────
let workerRunning = false;

async function autonomousWorker() {
  if (workerRunning) return;
  workerRunning = true;

  try {
    // Find pending tasks with proper priority sorting
    const result = await pool.query(
      `SELECT t.*, a.id as agent_id, a.company_id as agent_company_id
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_agent_id = a.id
       WHERE t.status = 'todo'
       ORDER BY
         CASE t.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         t.created_at ASC
       LIMIT 1`
    );

    if (result.rows.length > 0) {
      const task = result.rows[0];
      console.log(`⚡ Worker picking up task ${task.id}: ${task.title}`);

      // Auto-route if no agent assigned
      let assignedAgentId = task.agent_id;
      if (!assignedAgentId && task.tag) {
        const agentTypeMap = {
          engineering: 'engineering',
          browser: 'browser',
          research: 'research',
          growth: 'growth',
          data: 'data',
          support: 'support',
          content: 'content',
          twitter: 'twitter',
          outreach: 'outreach'
        };

        const agentType = agentTypeMap[task.tag];
        if (agentType) {
          const agentRes = await pool.query(
            'SELECT id FROM agents WHERE company_id = $1 AND type = $2 LIMIT 1',
            [task.company_id, agentType]
          );
          if (agentRes.rows[0]) {
            assignedAgentId = agentRes.rows[0].id;
            await pool.query('UPDATE tasks SET assigned_agent_id = $1 WHERE id = $2', [assignedAgentId, task.id]);
            console.log(`🔀 Auto-routed task ${task.id} to ${agentType} agent`);
          }
        }
      }

      // Skip if still no agent (shouldn't happen after routing)
      if (!assignedAgentId) {
        console.log(`⚠️ Skipping task ${task.id} - no agent available`);
        workerRunning = false;
        return;
      }

      // Create execution
      const execRes = await pool.query(
        `INSERT INTO executions (task_id, agent_id, company_id, status, logs)
         VALUES ($1, $2, $3, 'running', $4) RETURNING *`,
        [task.id, assignedAgentId, task.company_id, JSON.stringify([`[${new Date().toISOString()}] Task picked up by autonomous worker`])]
      );

      // Execute task (non-blocking)
      executeTask(task.id, execRes.rows[0].id, assignedAgentId, task.company_id);
    }
  } catch (e) {
    console.error('Worker error:', e);
  } finally {
    workerRunning = false;
  }
}

// Start autonomous worker (runs every 30 seconds)
setInterval(autonomousWorker, 30000);
console.log('✓ Autonomous task worker started (30s interval)');

// Run once on startup
setTimeout(autonomousWorker, 5000);

// ─── Agent seeder for new companies ──────────────────────────────────
async function seedAgentsForCompany(companyId) {
  // Get company name for personalized prompts
  const companyRes = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
  const companyName = companyRes.rows[0]?.name || 'your company';

  const agents = [
    {
      name: 'CEO Agent',
      type: 'ceo',
      icon: '👔',
      color: '#00e599',
      description: 'The chat interface — coordinates the team, provides strategic guidance, routes tasks',
      system_prompt: `You are Runloop's CEO agent for ${companyName}. Casual coworker, not consultant. 1-2 sentences max unless asked for more.

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
      system_prompt: `You are the Engineering agent for ${companyName}. You write code, fix bugs, and deploy to production. Push after EVERY file change. Verify with actual code, not grep.`,
      capabilities: ['code_generate', 'query_database', 'create_report', 'create_task']
    },
    {
      name: 'Research',
      type: 'research',
      icon: '🔍',
      color: '#6366f1',
      description: 'Conducts research, analyzes markets, delivers insights',
      system_prompt: `You are the Research specialist for ${companyName}. You search the web, analyze findings, and produce actionable insights. Every task MUST end with a saved report. Cite sources, distinguish facts vs opinions. Create reports with: Executive Summary, Key Findings (with sources), Recommended Actions.`,
      capabilities: ['web_search', 'web_scrape', 'summarize', 'create_document', 'create_report']
    },
    {
      name: 'Browser',
      type: 'browser',
      icon: '🌐',
      color: '#f59e0b',
      description: 'Handles browser-based tasks with site tier system',
      system_prompt: `You are the Browser agent for ${companyName}. You handle browser-based tasks.

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
      system_prompt: `You are the Data specialist for ${companyName}. Database queries, metrics, business intelligence. Explore schema first. Test queries before including in scripts. Lead with key findings, make recommendations actionable.`,
      capabilities: ['query_database', 'analyze_data', 'create_report']
    },
    {
      name: 'Support',
      type: 'support',
      icon: '💬',
      color: '#06b6d4',
      description: 'Responds to emails, resolves issues',
      system_prompt: `You are the Support specialist for ${companyName}. Respond to emails, resolve issues. Plain text only. Match question length. Human style, not template. Technical issues -> create task for Engineering. Billing disputes -> message owner.`,
      capabilities: ['get_inbox', 'send_email', 'add_contact', 'create_task']
    },
    {
      name: 'Twitter',
      type: 'twitter',
      icon: '🐦',
      color: '#1da1f2',
      description: 'Posts tweets (2/day limit)',
      system_prompt: `You are the Twitter agent for ${companyName}. Rate limit: 2/day. Char limit: 280. Voice: Dark humor, witty, bitter > excited. No emojis. No hashtags. Every tweet MUST include a link to the company website.`,
      capabilities: ['post_tweet', 'get_company_documents', 'create_report']
    },
    {
      name: 'Cold Outreach',
      type: 'cold_outreach',
      icon: '📧',
      color: '#ef4444',
      description: 'Finds leads, sends cold emails',
      system_prompt: `You are the Cold Outreach agent for ${companyName}.
1. Check inbound replies first
2. Research leads if pipeline empty — add 3-5 new prospects
3. Send outreach — up to 2 cold emails. Verify with find_email first.
4. Follow-ups — if contacted 5+ days ago, send follow-up.

Rate limits: 2/day cold, unlimited replies. 50-125 words. Plain text.
Voice: Founder-to-founder. Direct. Personal. One clear ask.`,
      capabilities: ['get_inbox', 'send_email', 'find_email', 'verify_email']
    }
  ];

  for (const a of agents) {
    const agentSlug = a.type.replace(/[^a-z0-9_]+/g, '-');
    await pool.query(
      'INSERT INTO agents (company_id, name, slug, type, description, system_prompt, icon) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
      [companyId, a.name, agentSlug, a.type, a.description, a.system_prompt, a.icon]
    );
  }
}

// ─── HTML Page Routes ──────────────────────────────────
const pages = ['login', 'signup', 'dashboard', 'onboarding', 'settings', 'pricing', 'about', 'agents'];

// Protected page routes
['dashboard', 'onboarding', 'settings', 'chat', 'memory', 'documents', 'cycles', 'skills', 'learnings', 'analytics', 'tasks', 'reports', 'workflows', 'email', 'agent-factory'].forEach(page => {
  app.get(`/${page}`, authMiddleware, (req, res) => {
    const htmlPath = path.join(__dirname, 'public', `${page}.html`);
    if (fs.existsSync(htmlPath)) {
      res.type('html').send(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.redirect('/dashboard');
    }
  });
});

// Agent detail route
app.get('/agents/:id', authMiddleware, (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'agent-detail.html');
  if (fs.existsSync(htmlPath)) {
    res.type('html').send(fs.readFileSync(htmlPath, 'utf8'));
  } else {
    res.redirect('/dashboard');
  }
});

// Public page routes
['login', 'signup', 'pricing', 'about'].forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const htmlPath = path.join(__dirname, 'public', `${page}.html`);
    if (fs.existsSync(htmlPath)) {
      res.type('html').send(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.redirect('/');
    }
  });
});

// Public company page (/:slug)
app.get('/company/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies WHERE slug = $1 AND status = $2', [req.params.slug, 'active']);
    if (!result.rows[0]) return res.status(404).type('html').send(`<!DOCTYPE html><html><head><title>Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#08090d;color:#e8e9ed;display:flex;align-items:center;justify-content:center;min-height:100vh}.c{text-align:center}h1{font-size:3rem;font-weight:700;color:#00e599;margin-bottom:16px}p{color:#7a7f8e;font-size:1.1rem;margin-bottom:24px}a{color:#00e599;text-decoration:none;padding:12px 24px;border:1px solid rgba(0,229,153,.3);border-radius:8px;transition:all .2s}a:hover{background:rgba(0,229,153,.1)}</style></head><body><div class="c"><h1>Company not found</h1><p>This company page doesn't exist</p><a href="/">Back to Runloop</a></div></body></html>`);
    const company = result.rows[0];
    const agents = await pool.query('SELECT name, icon, description FROM agents WHERE company_id = $1 AND is_active = true', [company.id]);
    res.type('html').send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${company.name} — Powered by Runloop</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#08090d;color:#e8e9ed;line-height:1.6;min-height:100vh}.hero{max-width:800px;margin:0 auto;padding:80px 24px;text-align:center}.logo{font-family:'Space Grotesk',sans-serif;font-size:2.5rem;font-weight:700;margin-bottom:16px;background:linear-gradient(135deg,#00e599,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}p.desc{color:#7a7f8e;font-size:1.1rem;max-width:600px;margin:0 auto 48px}.badge{display:inline-block;padding:6px 16px;background:rgba(0,229,153,.1);color:#00e599;border-radius:100px;font-size:13px;font-weight:600;margin-bottom:24px}.agents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;max-width:700px;margin:0 auto 48px}.agent-card{background:#0f1117;border:1px solid #1a1d27;border-radius:12px;padding:20px;text-align:center;transition:all .2s}.agent-card:hover{transform:translateY(-2px);border-color:#252838}.agent-icon{font-size:32px;margin-bottom:10px}.agent-name{font-size:14px;font-weight:600;margin-bottom:4px}.agent-desc{font-size:12px;color:#7a7f8e;line-height:1.4}.footer{text-align:center;padding:32px;color:#4a4f5e;font-size:13px}.footer a{color:#00e599;text-decoration:none}</style></head><body><div class="hero"><div class="badge">${company.industry || 'Technology'}</div><h1 class="logo">${company.name}</h1><p class="desc">${company.description || 'An AI-powered company running on Runloop'}</p>${agents.rows.length ? `<h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;font-weight:600;margin-bottom:20px">Our AI Team</h2><div class="agents-grid">${agents.rows.map(a => `<div class="agent-card"><div class="agent-icon">${a.icon || '🤖'}</div><div class="agent-name">${a.name}</div><div class="agent-desc">${(a.description || '').substring(0, 80)}</div></div>`).join('')}</div>` : ''}</div><div class="footer">Powered by <a href="/">Runloop</a></div></body></html>`);
  } catch (e) {
    res.status(500).type('html').send('Server error');
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Landing page
app.get('/', (req, res) => {
  const slug = process.env.POLSIA_ANALYTICS_SLUG || '';
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('__POLSIA_SLUG__', slug);
    res.type('html').send(html);
  } else {
    res.redirect('/dashboard');
  }
});

// 404 catch-all
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).type('html').send(`<!DOCTYPE html><html><head><title>404</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#08090d;color:#e8e9ed;display:flex;align-items:center;justify-content:center;min-height:100vh}.c{text-align:center}h1{font-size:6rem;font-weight:700;color:#00e599;margin-bottom:16px}p{color:#7a7f8e;font-size:1.2rem;margin-bottom:24px}a{color:#00e599;text-decoration:none;padding:12px 24px;border:1px solid rgba(0,229,153,.3);border-radius:8px;transition:all .2s}a:hover{background:rgba(0,229,153,.1)}</style></head><body><div class="c"><h1>404</h1><p>This page doesn't exist</p><a href="/">Back to Runloop</a></div></body></html>`);
});

// Global error handler — catches any unhandled errors in route handlers
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).type('html').send(`<!DOCTYPE html><html><head><title>Error</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#08090d;color:#e8e9ed;display:flex;align-items:center;justify-content:center;min-height:100vh}.c{text-align:center}h1{font-size:3rem;font-weight:700;color:#ef4444;margin-bottom:16px}p{color:#7a7f8e;font-size:1.1rem;margin-bottom:24px}a{color:#00e599;text-decoration:none;padding:12px 24px;border:1px solid rgba(0,229,153,.3);border-radius:8px;transition:all .2s}a:hover{background:rgba(0,229,153,.1)}</style></head><body><div class="c"><h1>Something went wrong</h1><p>We're on it. Try refreshing the page.</p><a href="/">Back to Runloop</a></div></body></html>`);
});

app.listen(port, () => {
  console.log(`Runloop running on port ${port}`);
});
