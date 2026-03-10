# Learnings System

Agent-generated knowledge capture. Agents save learnings from task execution, creating a growing knowledge base.

---

## Overview

**Learnings are facts/patterns agents discover during work.**

Examples:
- "JWT tokens should expire after 7 days for security"
- "Users abandon onboarding after 3+ steps"
- "Database indexes on foreign keys improve query speed 10x"
- "Cold emails with questions get 2x more replies"

**Purpose:**
- Agents get smarter over time
- Patterns emerge across tasks
- Avoid repeating mistakes
- Share knowledge across agents

---

## Learnings vs Memory

| Learnings | Memory |
|-----------|--------|
| Discrete facts | Contextual knowledge |
| Structured (title, category, tags) | Unstructured text |
| Queryable by category | Semantic search only |
| Confidence scores | No scoring |
| Agent-created | Auto-curated |
| Can be company-specific OR platform-wide | Always scoped to company (or platform) |

**Learnings feed INTO memory** during curation.

---

## Database Schema

```sql
CREATE TABLE learnings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, -- NULL = platform-wide

  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'process', 'business', 'user_behavior', 'infrastructure', 'debugging')),

  tags TEXT[],
  confidence FLOAT DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),

  created_by_agent_id BIGINT REFERENCES agents(id),
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learnings_company ON learnings(company_id);
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_tags ON learnings USING GIN(tags);
CREATE INDEX idx_learnings_confidence ON learnings(confidence);
CREATE INDEX idx_learnings_embedding ON learnings USING ivfflat (embedding vector_cosine_ops);
```

---

## MCP Tools

### 1. create_learning

**Create new learning**

```javascript
await mcpClient.callTool('learnings', 'create_learning', {
  title: "JWT expiration best practices",
  content: "JWT tokens should expire after 7 days for balance between security and UX. Refresh tokens extend to 30 days.",
  category: "technical",
  tags: ["auth", "security", "jwt"],
  confidence: 0.8
});
```

**Parameters:**
- `title` (required) - Short summary
- `content` (required) - Full explanation
- `category` (required) - technical, process, business, user_behavior, infrastructure, debugging
- `tags` (optional) - Array of keywords
- `confidence` (optional) - 0.0 to 1.0 (default: 0.5)

**Returns:**
```javascript
{
  success: true,
  learning_id: 801
}
```

### 2. query_learnings

**Query learnings by category/tags**

```javascript
await mcpClient.callTool('learnings', 'query_learnings', {
  category: "technical",
  tags: ["auth"],
  limit: 10
});
```

**Parameters:**
- `category` (optional) - Filter by category
- `tags` (optional) - Filter by tags (AND logic)
- `limit` (optional) - Default: 20

**Returns:**
```javascript
{
  success: true,
  learnings: [
    {
      id: 801,
      title: "JWT expiration best practices",
      content: "...",
      category: "technical",
      tags: ["auth", "security", "jwt"],
      confidence: 0.8,
      created_by: "Engineering",
      created_at: "2026-03-04T02:00:00Z"
    }
  ]
}
```

### 3. search_learnings

**Semantic search**

```javascript
await mcpClient.callTool('learnings', 'search_learnings', {
  query: "authentication best practices",
  limit: 5
});
```

**Returns:**
```javascript
{
  success: true,
  results: [
    {
      id: 801,
      title: "JWT expiration best practices",
      content: "...",
      relevance: 0.87,
      created_at: "2026-03-04T02:00:00Z"
    }
  ]
}
```

### 4. get_recent_learnings

**Get recent learnings**

```javascript
await mcpClient.callTool('learnings', 'get_recent_learnings', {
  limit: 10,
  days: 7
});
```

**Returns last N learnings from last X days.**

### 5. get_learnings_by_tags

**Get learnings by specific tags**

```javascript
await mcpClient.callTool('learnings', 'get_learnings_by_tags', {
  tags: ["auth", "security"]
});
```

---

## Categories

### technical

Code, architecture, database, APIs

Examples:
- "PostgreSQL JSONB queries 3x faster with GIN indexes"
- "Express middleware order matters - auth before routes"
- "React useEffect cleanup prevents memory leaks"

### process

Development workflows, deployment, testing

Examples:
- "Migrations should run before app starts"
- "Feature flags enable safe rollouts"
- "Code review catches 80% of bugs"

### business

Product, pricing, growth

Examples:
- "Free trials convert 15% higher than freemium"
- "Email sequences need 3-5 touches"
- "Annual plans reduce churn by 40%"

### user_behavior

UX, onboarding, retention

Examples:
- "Users abandon after 3+ onboarding steps"
- "Password reset should arrive within 2 minutes"
- "Dark mode increases engagement 25%"

### infrastructure

Hosting, scaling, performance

Examples:
- "Render free tier suspends after 15 days idle"
- "Database connection pooling prevents exhaustion"
- "CDN reduces load time 70%"

### debugging

Common errors, solutions

Examples:
- "CORS errors fixed by setting headers on OPTIONS"
- "Module not found = missing package.json dependency"
- "Cannot set headers after sent = double res.send()"

---

## Confidence Scores

**How to set confidence:**

- **0.1-0.3:** Hypothesis, untested
- **0.4-0.6:** Observed once, needs validation
- **0.7-0.8:** Observed multiple times, confident
- **0.9-1.0:** Proven with data, universal pattern

**Confidence increases over time:**
- Same learning observed again → +0.1
- Supporting evidence from other agents → +0.1
- User confirms it's correct → +0.2

**Confidence decreases:**
- Contradicted by new evidence → -0.2
- Fails when applied → -0.3

---

## When Agents Should Create Learnings

### After Task Completion

If agent discovered something new:
```javascript
// Engineering finishes database optimization task
await create_learning({
  title: "Adding index to foreign keys speeds up joins",
  content: "Query time dropped from 2.4s to 0.08s after adding index to user_id foreign key in tasks table.",
  category: "technical",
  tags: ["database", "performance", "postgres"],
  confidence: 0.8
});
```

### After Debugging

When fixing a bug:
```javascript
// Engineering fixes CORS error
await create_learning({
  title: "CORS requires OPTIONS preflight response",
  content: "CORS errors on POST requests resolved by adding OPTIONS handler that returns 204 with CORS headers.",
  category: "debugging",
  tags: ["cors", "api", "http"],
  confidence: 0.9
});
```

### After Research

Research agent findings:
```javascript
// Research agent analyzes competitors
await create_learning({
  title: "B2B SaaS pricing - 3 tier pattern dominates",
  content: "Analyzed 50 competitors. 84% use 3-tier pricing (Starter/Pro/Enterprise) with middle tier most popular.",
  category: "business",
  tags: ["pricing", "saas", "competition"],
  confidence: 0.75
});
```

### After User Feedback

When user reports something:
```javascript
// User complains about onboarding length
await create_learning({
  title: "Onboarding >5 steps causes drop-off",
  content: "User reported abandoning onboarding because 'too many questions.' Reducing to 3-4 core steps recommended.",
  category: "user_behavior",
  tags: ["onboarding", "ux", "conversion"],
  confidence: 0.6 // Single data point
});
```

---

## Agent Prompt Integration

**Agents should reference learnings before starting work:**

```javascript
// Before implementing auth
const learnings = await search_learnings({
  query: "authentication best practices"
});

// Include in agent context
const systemPrompt = `
${basePrompt}

## Relevant Learnings:
${learnings.map(l => `- ${l.title}: ${l.content}`).join('\n')}

Now implement: ${task.description}
`;
```

---

## UI Dashboard

### Location: `/dashboard/learnings`

**Sections:**
1. **Recent Learnings** - Last 20 added
2. **By Category** - Tabs for each category
3. **High Confidence** - Filter confidence > 0.7
4. **Search** - Full-text + semantic

**Design:**
```
┌────────────────────────────────────────────┐
│  Learnings                                 │
├────────────────────────────────────────────┤
│  [All] [Technical] [Business] [UX]         │
│  Search: [____________] [🔍]               │
├────────────────────────────────────────────┤
│  📚 JWT expiration best practices          │
│     Technical • Confidence: 80%            │
│     Auth, Security, JWT                    │
│     Engineering • 2 days ago               │
│                                            │
│  📚 Onboarding >5 steps causes drop-off   │
│     User Behavior • Confidence: 60%        │
│     Onboarding, UX, Conversion             │
│     Support • 5 days ago                   │
└────────────────────────────────────────────┘
```

---

## API Endpoints

### GET /api/learnings
List learnings with filters.

**Query params:**
- `category` - Filter by category
- `tags` - Comma-separated
- `min_confidence` - Default: 0.5
- `limit` - Default: 20
- `offset` - Default: 0

**Response:**
```json
{
  "learnings": [
    {
      "id": 801,
      "title": "JWT expiration best practices",
      "content": "...",
      "category": "technical",
      "tags": ["auth", "security", "jwt"],
      "confidence": 0.8,
      "created_by": {
        "id": 30,
        "name": "Engineering"
      },
      "created_at": "2026-03-04T02:00:00Z"
    }
  ],
  "total": 45
}
```

### POST /api/learnings
Create learning.

**Request:**
```json
{
  "title": "JWT expiration best practices",
  "content": "...",
  "category": "technical",
  "tags": ["auth", "security"],
  "confidence": 0.8
}
```

### GET /api/learnings/search
Search learnings.

**Query params:**
- `q` - Search query
- `limit` - Default: 10

**Response:**
```json
{
  "results": [
    {
      "id": 801,
      "title": "JWT expiration best practices",
      "excerpt": "...JWT tokens should expire after 7 days...",
      "relevance": 0.87,
      "created_at": "2026-03-04T02:00:00Z"
    }
  ]
}
```

---

## Platform-Wide vs Company-Specific

### Company-Specific (company_id NOT NULL)

Learnings unique to this company:
- "Our users prefer monthly billing"
- "Support tickets spike on Mondays"
- "Dashboard loads slow with >1000 tasks"

### Platform-Wide (company_id IS NULL)

Learnings applicable to ALL companies:
- "JWT tokens should expire after 7 days"
- "CORS requires OPTIONS preflight"
- "Database indexes improve query speed"

**CEO decides which learnings to promote to platform-wide:**
```javascript
// If confidence > 0.9 and applicable globally
if (learning.confidence > 0.9 && isGeneralizable(learning)) {
  await promoteToPlatformWide(learning.id);
}
```

---

## Automatic Curation

**Nightly process:**

1. **Find duplicates** - Merge similar learnings
2. **Update confidence** - Increase for repeated patterns
3. **Promote to platform** - High-confidence generalizable learnings
4. **Prune low-confidence** - Delete confidence < 0.3 after 30 days
5. **Update embeddings** - Regenerate for better search

```javascript
async function curateLearnings() {
  // 1. Merge duplicates
  const duplicates = await findDuplicateLearnings();
  for (const [keep, merge] of duplicates) {
    await mergeLearnings(keep, merge);
  }

  // 2. Update confidence for repeated patterns
  const patterns = await findRepeatedPatterns();
  for (const pattern of patterns) {
    await increaseConfidence(pattern.learning_id, 0.1);
  }

  // 3. Promote to platform-wide
  const candidates = await db.query(`
    SELECT * FROM learnings
    WHERE confidence > 0.9
      AND company_id IS NOT NULL
      AND id NOT IN (SELECT source_learning_id FROM platform_learnings)
  `);

  for (const learning of candidates) {
    if (await isGeneralizable(learning)) {
      await promoteToPlatformWide(learning);
    }
  }

  // 4. Prune low-confidence old learnings
  await db.query(`
    DELETE FROM learnings
    WHERE confidence < 0.3
      AND created_at < NOW() - INTERVAL '30 days'
  `);
}
```

---

## Example Learnings

### Technical

**Title:** "Express middleware order critical for auth"
**Content:** "Auth middleware must come BEFORE route handlers, otherwise routes run without authentication check. Error: 'Cannot set headers after they are sent' indicates middleware is out of order."
**Tags:** express, middleware, auth
**Confidence:** 0.9

### Business

**Title:** "Annual plans reduce churn by 40%"
**Content:** "Compared monthly vs annual billing. Annual subscribers churn at 5% vs 8% monthly. Upfront commitment = stronger intent. Offer discount to incentivize."
**Tags:** pricing, billing, churn, saas
**Confidence:** 0.75

### User Behavior

**Title:** "Password reset must arrive within 2 minutes"
**Content:** "Users expect immediate password reset emails. >2 minute delay causes support tickets. Check email service latency and queue depth."
**Tags:** ux, email, password, support
**Confidence:** 0.8

---

## Future Enhancements

(Not in V1)

- Learning upvoting (user confirms usefulness)
- Learning challenges (user disputes)
- Learning decay (reduce confidence over time if unused)
- Learning relationships (link related learnings)
- Learning export (markdown, PDF)
- Learning import (from external sources)
