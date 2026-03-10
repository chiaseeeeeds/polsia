# Skills System

Reusable procedures that agents can load and follow. Skills capture "how to do X" knowledge.

---

## Overview

**Skills are step-by-step procedures for common tasks.**

Examples:
- How to deploy to Render
- How to create a GitHub PR
- How to set up Meta Ads tracking
- How to optimize database queries

**Why Skills?**
- Agents don't re-discover procedures
- Consistency across executions
- Knowledge compounds over time
- New agents learn from past successes

---

## Skills vs Learnings

| Skills | Learnings |
|--------|-----------|
| Procedures (how-to) | Facts (what is) |
| Step-by-step instructions | Insights and patterns |
| Agent follows steps | Agent references knowledge |
| Markdown format | Structured data |
| Created after successful execution | Created during execution |

---

## Database Schema

```sql
CREATE TABLE skills (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  skill_name TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown

  keywords TEXT[] NOT NULL,
  agent_types TEXT[], -- NULL = all agents can use

  usage_count INT DEFAULT 0,
  created_by_model TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skills_keywords ON skills USING GIN(keywords);
CREATE INDEX idx_skills_name ON skills(skill_name);
```

---

## MCP Tools

### 1. search_skills

**Search for relevant skills**

```javascript
await mcpClient.callTool('skills', 'search_skills', {
  query: "deploy render",
  limit: 5
});
```

**Returns:**
```javascript
{
  success: true,
  count: 2,
  skills: [
    {
      skill_name: "deploy-to-render",
      summary: "Deploy Express apps to Render",
      keywords: ["deploy", "render", "express"],
      usage_count: 247
    }
  ]
}
```

### 2. load_skill

**Load full skill content**

```javascript
await mcpClient.callTool('skills', 'load_skill', {
  skill_name: "deploy-to-render"
});
```

**Returns:**
```javascript
{
  success: true,
  skill: {
    skill_name: "deploy-to-render",
    summary: "Deploy Express apps to Render",
    content: "## When to Use\n\n...",
    usage_count: 248 // Incremented
  }
}
```

### 3. create_skill

**Save new skill** (agents call this after successful task)

```javascript
await mcpClient.callTool('skills', 'create_skill', {
  skill_name: "optimize-postgres-queries",
  summary: "Add indexes to improve query performance",
  content: `
## When to Use
Queries taking >1 second, high database CPU

## Prerequisites
- Access to database
- Ability to run migrations
- SQL query logs

## Procedure
1. Identify slow queries with EXPLAIN ANALYZE
2. Check for missing indexes on WHERE/JOIN columns
3. Create indexes: CREATE INDEX idx_name ON table(column)
4. Test query performance before/after
5. Deploy index via migration

## Common Pitfalls
- Don't index every column (storage cost)
- Indexes slow down writes
- Composite indexes order matters
  `,
  keywords: ["database", "performance", "postgres", "index"],
  agent_types: ["engineering", "data"]
});
```

**Parameters:**
- `skill_name` (required) - kebab-case name
- `summary` (required) - One-line description
- `content` (required) - Markdown with ## headings
- `keywords` (required) - Array of search keywords
- `agent_types` (optional) - Restrict to specific agents

### 4. update_skill

**Update existing skill** (if procedure improves)

```javascript
await mcpClient.callTool('skills', 'update_skill', {
  skill_name: "deploy-to-render",
  content: "## When to Use\n\n[Updated procedure...]"
});
```

---

## Skill Content Format

**Required sections:**

```markdown
## When to Use
[Describe when this skill applies]

## Prerequisites
- [What must be true before starting]
- [Required tools/access]

## Procedure
1. [Step one]
2. [Step two]
3. [Step three]

## Common Pitfalls
- [Things that can go wrong]
- [How to avoid them]
```

**Example: Deploy to Render**

```markdown
## When to Use
After code changes, when ready to deploy to production.

## Prerequisites
- Code committed to git
- `push_to_remote` tool available
- Instance ID known

## Procedure
1. Ensure all changes committed: `git status`
2. Push to remote: `push_to_remote({ instance_id, repo_path: '.' })`
3. Wait 60-90s for deploy to complete
4. Verify deployment with `get_logs({ instance_id, type: 'app' })`
5. Check health endpoint: `curl https://app.domain.com/health`

## Common Pitfalls
- Don't call `get_logs` immediately after push (deploy takes time)
- Migrations run automatically (don't run manually)
- Node modules install automatically (don't commit node_modules)
- Environment variables persist (don't need to set on every deploy)
```

---

## Platform Skills

**Platform provides these skills by default:**

1. **deploy-to-render** - Deploy Express apps
2. **create-github-pr** - Create pull requests
3. **setup-meta-ads** - Configure Meta ad campaigns
4. **optimize-postgres** - Database performance
5. **debug-cors-errors** - Fix CORS issues
6. **implement-auth** - Add JWT authentication
7. **setup-email** - Configure transactional email
8. **create-landing-page** - Build marketing site

**Located in:** `/skills/` directory as markdown files

---

## Local Skill Files

**Companies can add local skills:**

**Location:** `.claude/skills/[skill-name]/SKILL.md`

**Example:** `.claude/skills/agent-sdk/SKILL.md`

**These take precedence over platform skills** (company-specific procedures).

---

## Agent Integration

**Agents should:**

1. **Search before starting work:**
```javascript
const skills = await search_skills({
  query: task.description
});

if (skills.length > 0) {
  const skill = await load_skill({ skill_name: skills[0].skill_name });
  // Follow skill procedure
}
```

2. **Save skills after success:**
```javascript
// Task completed successfully
if (isNovelProcedure(task)) {
  await create_skill({
    skill_name: deriveSkillName(task),
    summary: task.title,
    content: generateSkillContent(executionLog),
    keywords: extractKeywords(task)
  });
}
```

3. **Update skills if improved:**
```javascript
// Found better way to do something
if (existingSkill && foundImprovement) {
  await update_skill({
    skill_name: existingSkill.name,
    content: improvedProcedure
  });
}
```

---

## UI Dashboard

**Location:** `/dashboard/skills`

**Sections:**
1. **All Skills** - Full list with search
2. **By Category** - Engineering, Growth, Operations
3. **Most Used** - Sort by usage_count
4. **Recently Added** - Last 30 days

**Design:**
```
┌────────────────────────────────────────────┐
│  Skills                                    │
├────────────────────────────────────────────┤
│  Search: [deploy render___] [🔍]          │
│                                            │
│  📚 deploy-to-render (247 uses)           │
│     Deploy Express apps to Render          │
│     Keywords: deploy, render, express      │
│     [View] [Edit]                          │
│                                            │
│  📚 optimize-postgres-queries (89 uses)   │
│     Add indexes to improve performance     │
│     Keywords: database, postgres, index    │
│     [View] [Edit]                          │
└────────────────────────────────────────────┘
```

---

## API Endpoints

### GET /api/skills
List all skills.

**Query params:**
- `q` - Search query
- `limit` - Default: 50

**Response:**
```json
{
  "skills": [
    {
      "skill_name": "deploy-to-render",
      "summary": "Deploy Express apps to Render",
      "usage_count": 247,
      "keywords": ["deploy", "render", "express"],
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 35
}
```

### GET /api/skills/:name
Get skill details.

**Response:**
```json
{
  "skill": {
    "skill_name": "deploy-to-render",
    "summary": "Deploy Express apps to Render",
    "content": "## When to Use\n\n...",
    "usage_count": 247,
    "keywords": ["deploy", "render", "express"]
  }
}
```

### POST /api/skills
Create new skill.

**Request:**
```json
{
  "skill_name": "optimize-postgres",
  "summary": "Improve query performance",
  "content": "## When to Use\n\n...",
  "keywords": ["database", "postgres"]
}
```

### PUT /api/skills/:name
Update skill.

**Request:**
```json
{
  "content": "## When to Use\n\n[Updated content]"
}
```

---

## Skill Discovery

**Agents use semantic search:**

1. **Keyword match** - Search `keywords` array
2. **Title match** - Search `skill_name` and `summary`
3. **Content search** - Full-text search in `content`

**Ranking:**
- Exact keyword match: highest
- Title match: high
- Content match: medium
- Usage count: tiebreaker

---

## Skill Curation

**Nightly process:**

1. **Find duplicates** - Merge similar skills
2. **Update popular skills** - Improve based on usage
3. **Archive unused** - Skills not used in 90 days
4. **Promote local to platform** - Company skills → platform

```javascript
async function curateSkills() {
  // Find duplicates
  const duplicates = await findDuplicateSkills();
  for (const [keep, remove] of duplicates) {
    await mergeSkills(keep, remove);
  }

  // Archive unused
  await db.query(`
    UPDATE skills
    SET archived = true
    WHERE usage_count = 0
      AND created_at < NOW() - INTERVAL '90 days'
  `);

  // Promote high-usage company skills
  const candidates = await db.query(`
    SELECT * FROM local_skills
    WHERE usage_count > 50
      AND NOT EXISTS (
        SELECT 1 FROM skills WHERE skill_name = local_skills.skill_name
      )
  `);

  for (const skill of candidates) {
    await promoteToPlatform(skill);
  }
}
```

---

## Example Skills

### 1. Deploy to Render

**Name:** deploy-to-render
**Summary:** Deploy Express apps to Render
**Keywords:** deploy, render, express, production
**Content:** [See above]

### 2. Create GitHub PR

**Name:** create-github-pr
**Summary:** Create pull request with proper format
**Content:**
```markdown
## When to Use
After completing feature on branch, ready for review.

## Prerequisites
- Changes committed to feature branch
- Branch pushed to origin
- Main branch is up to date

## Procedure
1. Verify branch: `git branch --show-current`
2. Push branch: `git push -u origin branch-name`
3. Create PR: `gh pr create --title "..." --body "..."`
4. Include in description:
   - What changed
   - Why (link to task)
   - How to test
   - Screenshots if UI change
5. Request reviews: `gh pr edit --add-reviewer username`

## Common Pitfalls
- Don't create PR before pushing branch
- Don't merge your own PRs immediately
- Don't forget to link related task/issue
```

---

## Future Enhancements

(Not in V1)

- Skill versioning (track changes over time)
- Skill testing (verify procedure still works)
- Skill branching (company-specific variants)
- Skill dependencies (skill A requires skill B)
- Skill templates (start from template)
- Skill export/import (share between companies)
- Skill analytics (success rate, completion time)
