# Memory System

Three-layer memory architecture that provides context to all agents. Think of it as the company's shared brain.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Layer 1: Domain Knowledge (15K tokens) │
│  Company-specific technical knowledge   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 2: Preferences (3K tokens)       │
│  User preferences and context           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 3: Cross-Company (15K tokens)    │
│  Patterns learned across all companies  │
└─────────────────────────────────────────┘
```

---

## Layer 1: Domain Knowledge

**Purpose:** Company-specific technical and business knowledge

**Token Limit:** 15,000 tokens

**Auto-Curated After:**
- Task completion
- Agent execution
- Deployment
- User feedback

**Content Examples:**
- "Authentication uses JWT with 7-day expiration"
- "Database hosted on Neon with 10GB limit"
- "Email service configured with Postmark"
- "Payment processing via Stripe Connect"
- "Deploy target: Render.com on free tier"

**Curation Strategy:**
- Extract facts from task execution logs
- De-duplicate similar information
- Prioritize recent and frequently accessed info
- Remove stale or incorrect information

**Database Schema:**
```sql
CREATE TABLE memory_layer1 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI ada-002
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX idx_layer1_company ON memory_layer1(company_id);
CREATE INDEX idx_layer1_embedding ON memory_layer1 USING ivfflat (embedding vector_cosine_ops);
```

---

## Layer 2: User & Company Preferences

**Purpose:** User preferences, business context, and goals

**Token Limit:** 3,000 tokens

**Updated By:** CEO only (not auto-curated)

**Content Examples:**
- "Owner prefers dark mode UI"
- "Target market: B2B SaaS founders"
- "Brand voice: casual, witty, technical"
- "No marketing on weekends"
- "Prioritize speed over features"

**Update Triggers:**
- User explicitly states preference
- Repeated patterns in user feedback
- CEO observes consistent behavior

**Database Schema:**
```sql
CREATE TABLE memory_layer2 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) UNIQUE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer2_company ON memory_layer2(company_id);
```

---

## Layer 3: Cross-Company Patterns

**Purpose:** Learnings from ALL companies on the platform

**Token Limit:** 15,000 tokens

**Auto-Curated After:**
- Successful task patterns
- Common failure modes
- Effective agent strategies
- Platform-wide learnings

**Content Examples:**
- "JWT refresh tokens reduce logout complaints by 67%"
- "Users expect password reset within 2 min of request"
- "Landing pages with video convert 3x better"
- "Onboarding completion drops 40% after 3 steps"
- "Email verification required for low-spam signups"

**Access:** Read-only for all agents (shared knowledge)

**Database Schema:**
```sql
CREATE TABLE memory_layer3 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT, -- technical, ux, marketing, infrastructure
  confidence FLOAT, -- 0.0 to 1.0
  supporting_evidence_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layer3_category ON memory_layer3(category);
CREATE INDEX idx_layer3_embedding ON memory_layer3 USING ivfflat (embedding vector_cosine_ops);
```

---

## MCP Tools

### 1. search_memory

**Semantic search across all 3 layers**

```javascript
await mcpClient.callTool('memory', 'search_memory', {
  query: "authentication setup",
  layers: [1, 2, 3], // optional, default: all
  limit: 5
});
```

**Returns:**
```javascript
{
  success: true,
  results: [
    {
      layer: 1,
      content: "Authentication uses JWT with 7-day expiration...",
      relevance: 0.87,
      last_accessed_at: "2026-03-01T10:00:00Z"
    },
    {
      layer: 3,
      content: "JWT refresh tokens reduce logout complaints...",
      relevance: 0.72,
      category: "technical"
    }
  ]
}
```

### 2. read_memory

**Read full content from specific layer**

```javascript
await mcpClient.callTool('memory', 'read_memory', {
  layer: 1
});
```

**Returns:**
```javascript
{
  success: true,
  content: "# Domain Knowledge\n\n## Authentication\n...",
  token_count: 8234,
  last_updated: "2026-03-03T22:00:00Z"
}
```

### 3. update_memory

**Update memory layer (CEO only for Layer 2)**

```javascript
await mcpClient.callTool('memory', 'update_memory', {
  layer: 2,
  content: "Owner prefers minimal UI with dark mode..."
});
```

**Returns:**
```javascript
{
  success: true,
  message: "Memory layer 2 updated",
  token_count: 2847
}
```

---

## Conversation Auto-Save

**Every 20 messages**, conversation context is automatically saved to Layer 1.

**What gets saved:**
- Key decisions made
- User preferences revealed
- Technical constraints discovered
- Business context learned

**What doesn't get saved:**
- Casual chit-chat
- Redundant information
- Temporary states
- Debugging logs

**Algorithm:**
```javascript
function shouldSaveToMemory(message) {
  return (
    containsDecision(message) ||
    containsPreference(message) ||
    containsTechnicalDetail(message) ||
    containsBusinessContext(message)
  ) && !isRedundant(message);
}
```

---

## Agent Memory Access Pattern

**Before starting any task:**

```javascript
// 1. Search for relevant context
const memoryResults = await search_memory({
  query: taskDescription
});

// 2. Include in agent prompt
const systemPrompt = `
${baseAgentPrompt}

## Relevant Memory:
${memoryResults.map(r => r.content).join('\n\n')}

Now execute: ${taskDescription}
`;
```

**After completing task:**

```javascript
// Extract learnings
const learnings = extractLearnings(executionLog);

// Update Layer 1
if (learnings.length > 0) {
  await update_memory({
    layer: 1,
    content: learnings.join('\n')
  });
}
```

---

## Memory Curation

**Nightly Process:**

1. **Layer 1 Curation** (per company)
   - Aggregate task execution logs
   - Extract factual statements
   - De-duplicate similar facts
   - Remove contradictions (keep newest)
   - Prune least-accessed (if >15K tokens)

2. **Layer 3 Curation** (platform-wide)
   - Identify patterns across companies
   - Calculate confidence scores
   - Merge similar learnings
   - Promote high-confidence patterns
   - Archive low-confidence patterns

**Curation Algorithm:**
```javascript
async function curateLayer1(companyId) {
  const facts = await extractFactsFromLogs(companyId);
  const deduped = deduplicateFacts(facts);
  const validated = removeContradictions(deduped);
  const prioritized = prioritizeByAccess(validated);
  const trimmed = trimToTokenLimit(prioritized, 15000);

  await saveMemory(companyId, 1, trimmed);
}
```

---

## Embedding Generation

**Vector embeddings** enable semantic search.

**Provider:** OpenAI text-embedding-ada-002 (1536 dimensions)

**When generated:**
- On memory update
- On conversation save
- During curation

**Similarity search:**
```sql
SELECT
  content,
  1 - (embedding <=> query_embedding) AS similarity
FROM memory_layer1
WHERE company_id = $1
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

---

## Memory API Endpoints

### GET /api/memory/search
```javascript
// Query: ?q=authentication&layers=1,2,3&limit=5
{
  results: [
    {
      layer: 1,
      content: "...",
      relevance: 0.87
    }
  ]
}
```

### GET /api/memory/layer/:layerId
```javascript
{
  content: "...",
  token_count: 8234,
  last_updated: "2026-03-03T22:00:00Z"
}
```

### PUT /api/memory/layer/:layerId
```javascript
// Body: { content: "..." }
{
  success: true,
  token_count: 8234
}
```

---

## Memory Dashboard UI

**Located at:** `/dashboard/memory`

**Features:**
- View all 3 layers
- Search across layers
- Manual edits (Layer 2 only)
- Token usage visualization
- Recently accessed memory
- Memory timeline (what was learned when)

**Design:**
```
┌────────────────────────────────────────────────┐
│  Memory Dashboard                              │
├────────────────────────────────────────────────┤
│  [Layer 1: 8.2K] [Layer 2: 1.4K] [Layer 3: RO] │
├────────────────────────────────────────────────┤
│  Search: [___________] [Search All Layers]     │
├────────────────────────────────────────────────┤
│  ## Layer 1: Domain Knowledge                  │
│                                                │
│  ### Authentication                            │
│  Uses JWT with 7-day expiration...            │
│  [Edit] [Delete]                               │
│                                                │
│  ### Database                                  │
│  Hosted on Neon (10GB limit)...               │
│  [Edit] [Delete]                               │
└────────────────────────────────────────────────┘
```

---

## Memory Best Practices

### For Agents

**DO:**
- Search memory before starting work
- Update memory after learning something new
- Reference memory in reports ("As noted in memory...")
- Trust memory over re-discovering facts

**DON'T:**
- Blindly trust outdated memory (check timestamps)
- Save temporary/transient information
- Duplicate information already in memory
- Save debugging logs to memory

### For CEO

**DO:**
- Update Layer 2 when user states preferences
- Use memory to avoid asking same questions
- Reference memory in conversations ("I remember you prefer...")
- Prune Layer 2 if it becomes contradictory

**DON'T:**
- Auto-update Layer 2 (CEO only)
- Overwrite Layer 1 (it's auto-curated)
- Modify Layer 3 (platform-managed)

---

## Performance Considerations

**Token limits prevent context bloat:**
- Layer 1: 15K tokens ≈ 60KB text
- Layer 2: 3K tokens ≈ 12KB text
- Layer 3: 15K tokens ≈ 60KB text
- **Total:** 33K tokens per agent context

**Embedding search is fast:**
- Vector index (ivfflat) makes similarity search O(log n)
- Typical search: <50ms for 10K entries

**Auto-save doesn't block:**
- Runs asynchronously every 20 messages
- Doesn't delay user responses

---

## Future Enhancements

(Not in V1)

- **Forgetting curve**: Auto-prune memory not accessed in 90 days
- **Memory conflicts**: Detect contradictions and prompt resolution
- **Memory export**: Download company memory as markdown
- **Memory visualization**: Graph of knowledge connections
- **Memory versioning**: Track how memory evolved over time
