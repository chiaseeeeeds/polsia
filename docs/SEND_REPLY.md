# send_reply System

Real-time agent-to-user communication. Agents push messages INTO the chat during execution, making the platform feel LIVE.

---

## Problem It Solves

**Without send_reply:**
- User waits in silence while agent works
- No visibility into progress
- Feels like a black box
- User doesn't know if anything is happening

**With send_reply:**
- Agent streams updates in real-time
- User sees progress as it happens
- Platform feels alive and responsive
- Trust builds through transparency

---

## How It Works

### 1. Agent Execution Context

When an agent executes a task, it has access to:
- The conversation ID
- The ability to call `send_reply()`

### 2. Mid-Execution Updates

```javascript
// Agent is working on a task
await send_reply({
  message: "Starting login bug fix...",
  agent_name: "Engineering"
});

// Do some work
await read_file('public/login.html');

await send_reply({
  message: "Found the issue - button color is hardcoded. Fixing now.",
  agent_name: "Engineering"
});

// Fix the issue
await edit_file(...);

await send_reply({
  message: "Fixed. Deploying...",
  agent_name: "Engineering"
});

// Deploy
await push_to_remote({ instance_id, repo_path: '.' });

await send_reply({
  message: "✅ Deployed. Test at https://app.runloop.com/login",
  agent_name: "Engineering"
});
```

### 3. User Sees Updates in Real-Time

User's chat interface receives messages via SSE (Server-Sent Events):

```
[4:10:23 PM] Engineering
Starting login bug fix...

[4:10:31 PM] Engineering
Found the issue - button color is hardcoded. Fixing now.

[4:11:02 PM] Engineering
Fixed. Deploying...

[4:12:15 PM] Engineering
✅ Deployed. Test at https://app.runloop.com/login
```

---

## MCP Tool Specification

### send_reply

**Parameters:**
```javascript
{
  message: string,        // Required: The message to send
  agent_name?: string,    // Optional: Agent name (inferred from context if not provided)
  metadata?: object       // Optional: Additional data (links, attachments, etc.)
}
```

**Returns:**
```javascript
{
  success: boolean,
  message_id: number
}
```

**Example:**
```javascript
await mcpClient.callTool('send_reply', 'send_reply', {
  message: "Starting deployment...",
  agent_name: "Engineering"
});
```

---

## Database Schema

### messages table

```sql
CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Agent attribution
  agent_id BIGINT REFERENCES agents(id),
  agent_name TEXT,

  -- Source
  source TEXT, -- 'chat', 'task_execution', 'cycle_review'

  -- Tool calls (for assistant messages)
  tool_calls JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  token_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_agent ON messages(agent_id);
```

**When send_reply is called:**
```sql
INSERT INTO messages (conversation_id, role, content, agent_name, source)
VALUES ($1, 'assistant', $2, $3, 'task_execution');
```

---

## Real-Time Delivery (SSE)

### Client Connection

```javascript
// Client opens SSE connection
const eventSource = new EventSource('/api/conversations/123/stream');

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);

  // Append to chat UI
  appendMessage({
    id: message.id,
    role: message.role,
    content: message.content,
    agent_name: message.agent_name,
    timestamp: message.created_at
  });
};
```

### Server Broadcast

```javascript
// Server sends SSE when send_reply is called
function broadcastMessage(conversationId, message) {
  const clients = sseClients.get(conversationId);

  if (clients) {
    clients.forEach(client => {
      client.write(`data: ${JSON.stringify(message)}\n\n`);
    });
  }
}
```

---

## Use Cases

### 1. Task Progress Updates

Engineering agent deploying:
```
"Starting deployment..."
"Building application..."
"Running database migrations..."
"Deployment complete. Live at https://app.runloop.com"
```

### 2. Research Findings

Research agent analyzing:
```
"Found 5 key competitors..."
"Analyzing pricing strategies..."
"Compiling report..."
"Report ready: [link]"
```

### 3. Error Handling

When something goes wrong:
```
"Deployment failed. Checking logs..."
"Found error: Missing DATABASE_URL env var"
"Created task to fix configuration"
```

### 4. Multi-Step Workflows

Cold Outreach agent:
```
"Checking inbox for replies..."
"Found 2 new responses"
"Drafting reply to Jane@example.com..."
"Sent reply"
```

### 5. Cycle Reviews

Nightly cycle completion:
```
"Good morning! Overnight progress:"
"✅ Fixed login button (9/10)"
"✅ Researched competitors (8/10)"
"⚠️ OAuth blocked - need credentials"
```

---

## UI Design

### Message Display

```html
<div class="message agent">
  <div class="message-avatar">
    <img src="/agent/30/avatar" alt="Engineering" />
  </div>
  <div class="message-content">
    <div class="message-header">
      <span class="agent-name">Engineering</span>
      <span class="timestamp">4:10 PM</span>
    </div>
    <div class="message-text">
      Starting login bug fix...
    </div>
  </div>
</div>
```

### Typing Indicator

Show "..." while agent is thinking:
```html
<div class="typing-indicator">
  <div class="agent-avatar">
    <img src="/agent/30/avatar" alt="Engineering" />
  </div>
  <div class="typing-dots">
    <span></span>
    <span></span>
    <span></span>
  </div>
</div>
```

### Progress Messages

```css
.message.progress {
  opacity: 0.8;
  font-size: 13px;
}

.message.progress .status-icon {
  animation: spin 1s linear infinite;
}
```

---

## Best Practices for Agents

### DO:

**Provide status updates:**
```javascript
await send_reply({ message: "Starting task..." });
// ... work
await send_reply({ message: "Completed successfully" });
```

**Explain what you're doing:**
```javascript
await send_reply({ message: "Reading authentication code..." });
await read_file('lib/auth.js');
await send_reply({ message: "Found the issue in JWT validation" });
```

**Share results:**
```javascript
await send_reply({
  message: "Deployed to production: https://app.runloop.com"
});
```

**Report errors transparently:**
```javascript
await send_reply({
  message: "Deployment failed. Error: Missing env variable. Creating task to fix."
});
```

### DON'T:

**Spam with too many messages:**
❌ Send 50 messages for a single task
✅ Send 3-5 meaningful updates

**Send technical jargon:**
❌ "Running pg_dump with --clean --if-exists flags"
✅ "Backing up database..."

**Leave user hanging:**
❌ Start work silently
✅ "Starting work on this now..."

**Send empty/useless messages:**
❌ "..."
❌ "Working..."
✅ "Analyzing authentication code..."

---

## Message Formatting

### Basic Text

```javascript
await send_reply({
  message: "Deployed successfully"
});
```

### With Links

```javascript
await send_reply({
  message: "Deployed to https://app.runloop.com"
});
// UI auto-linkifies URLs
```

### With Emoji

```javascript
await send_reply({
  message: "✅ All tests passing"
});
```

### Multi-Line

```javascript
await send_reply({
  message: `
Deployment complete!

✅ Build: 2m 15s
✅ Tests: All passing
✅ Deploy: Success

Live at: https://app.runloop.com
  `.trim()
});
```

### With Markdown (Future)

```javascript
await send_reply({
  message: "**Bold** and *italic* text",
  format: "markdown" // Not in V1
});
```

---

## Performance Considerations

### Rate Limiting

Don't spam the chat:
```javascript
// BAD - too many messages
for (const file of files) {
  await send_reply({ message: `Processing ${file}` });
}

// GOOD - batch updates
await send_reply({ message: `Processing ${files.length} files...` });
// ... process all
await send_reply({ message: "All files processed" });
```

### Message Batching

For rapid updates, batch:
```javascript
const updates = [];
for (const item of items) {
  updates.push(processItem(item));
}

await Promise.all(updates);
await send_reply({ message: `Processed ${items.length} items` });
```

### Connection Management

**SSE connection handling:**
- Auto-reconnect on disconnect
- Heartbeat every 30s
- Close connections after 1 hour idle

---

## API Endpoints

### GET /api/conversations/:id/stream

**Server-Sent Events endpoint**

**Response:**
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message
data: {"id": 1001, "role": "assistant", "content": "Starting...", "agent_name": "Engineering"}

event: message
data: {"id": 1002, "role": "assistant", "content": "Deployed!", "agent_name": "Engineering"}

event: ping
data: {}
```

### POST /api/send-reply

**Internal endpoint** (called by MCP server)

**Request:**
```json
{
  "conversation_id": 123,
  "message": "Starting deployment...",
  "agent_name": "Engineering",
  "source": "task_execution"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": 1001
}
```

---

## Testing send_reply

### Manual Test

```javascript
// Send test message
await mcpClient.callTool('send_reply', 'send_reply', {
  message: "Test message from agent",
  agent_name": "Engineering"
});

// Verify in UI
// Should appear in chat immediately
```

### Integration Test

```javascript
describe('send_reply', () => {
  it('delivers message to active conversation', async () => {
    const conversationId = 123;

    // Open SSE connection
    const messages = [];
    const eventSource = new EventSource(`/api/conversations/${conversationId}/stream`);
    eventSource.onmessage = (event) => {
      messages.push(JSON.parse(event.data));
    };

    // Send message
    await sendReply({
      conversation_id: conversationId,
      message: "Test",
      agent_name: "Engineering"
    });

    // Wait for delivery
    await waitFor(() => messages.length > 0);

    expect(messages[0].content).toBe("Test");
    expect(messages[0].agent_name).toBe("Engineering");
  });
});
```

---

## Error Handling

### Connection Lost

```javascript
// Client detects disconnect
eventSource.onerror = () => {
  console.log('Connection lost. Reconnecting...');

  // Show indicator
  showNotification('Connection lost. Reconnecting...');

  // Reconnect after delay
  setTimeout(() => {
    reconnectSSE();
  }, 3000);
};
```

### Message Delivery Failure

```javascript
// Server logs failure
try {
  await broadcastMessage(conversationId, message);
} catch (error) {
  console.error('Failed to deliver message:', error);
  // Save to pending queue
  await savePendingMessage(conversationId, message);
}
```

### Retry Failed Messages

```javascript
// Retry pending messages on reconnect
async function reconnectSSE() {
  const eventSource = new EventSource(streamUrl);

  // Request pending messages
  const pending = await fetch('/api/conversations/123/pending');
  const messages = await pending.json();

  // Display missed messages
  messages.forEach(msg => appendMessage(msg));
}
```

---

## Analytics

**Track these metrics:**
- Messages sent per task
- Avg time between updates
- User engagement (scroll/read)
- Connection uptime

**Goals:**
- 3-5 messages per task (not too few, not too many)
- Update every 20-30 seconds during execution
- 99.9% message delivery rate

---

## Future Enhancements

(Not in V1)

- Rich media (images, videos)
- Code blocks with syntax highlighting
- Interactive buttons/actions
- Message reactions (👍 from user)
- Message threading
- Voice messages from agents
- Typing indicator shows agent name
