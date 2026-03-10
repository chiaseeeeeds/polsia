# MCP Servers & Tools

Complete inventory of all 22 MCP servers available to agents. Each server provides specific capabilities through well-defined tools.

---

## 1. polsia_infra

**Purpose:** Infrastructure management for Polsia apps

### Tools

- `create_instance({ template, name?, description? })` - Create new Render service + GitHub repo + Neon database
- `push_to_remote({ instance_id, repo_path })` - Push code changes to remote and trigger deploy
- `push_to_prod({ instance_id })` - Promote staging to production
- `get_status({ instance_id })` - Get deployment status and health
- `get_logs({ instance_id, type, since?, pattern? })` - Fetch application or build logs
- `get_preview({ instance_id })` - Get preview URL for the instance
- `query_db({ instance_id, query })` - Execute SQL queries on the database
- `list_instances()` - List all instances for the company
- `delete_instance({ instance_id })` - Delete service, repo, and database
- `get_env_vars({ instance_id })` - Get environment variables
- `update_env_vars({ instance_id, env_vars })` - Update environment variables
- `rename_instance({ instance_id, new_name })` - Rename an instance
- `resume_service({ instance_id })` - Resume a suspended service

---

## 2. github

**Purpose:** Direct GitHub repository operations

### Tools

- `read_file({ repo, path, ref? })` - Read file contents from GitHub
- `write_file({ repo, path, content, message, branch? })` - Write/update file in repo
- `create_branch({ repo, branch, from_branch? })` - Create new branch
- `create_commit({ repo, branch, message, files })` - Create commit with multiple files
- `create_pr({ repo, title, body, head, base })` - Create pull request
- `search_code({ query, repo? })` - Search code across repositories
- `list_files({ repo, path?, ref? })` - List files in directory

---

## 3. github_publish

**Purpose:** User-authenticated GitHub publishing

### Tools

- `request_publish({ repo_url, branch, message })` - Request user to publish code via their GitHub account (requires OAuth)

---

## 4. meta_ads

**Purpose:** Meta (Facebook/Instagram) advertising platform

### Tools

- `create_campaign({ name, objective, budget })` - Create ad campaign
- `create_adset({ campaign_id, name, targeting, budget })` - Create ad set
- `create_ad({ adset_id, name, creative })` - Create ad
- `upload_ad_video({ video_url, description })` - Upload video creative
- `create_video_creative({ video_id, caption, call_to_action })` - Create video creative
- `activate_campaign({ campaign_id })` - Activate campaign
- `save_ad({ ad_data })` - Save ad to database
- `update_ad_metrics({ ad_id, metrics })` - Update ad performance metrics
- `add_captions({ video_id, captions })` - Add captions to video
- `get_ad_account()` - Get Meta ad account details
- `list_campaigns()` - List all campaigns
- `get_campaign_insights({ campaign_id, date_preset? })` - Get campaign performance data

---

## 5. twitter

**Purpose:** Twitter/X posting

### Tools

- `post_tweet({ text, reply_to? })` - Post tweet (280 char limit, 2/day limit)
- `get_twitter_account()` - Get connected Twitter account info

---

## 6. render

**Purpose:** Direct Render.com infrastructure access

### Tools

- `list_services()` - List all Render services
- `get_service({ service_id })` - Get service details
- `deploy_service({ service_id })` - Trigger manual deploy
- `get_metrics({ service_id, metric_type, start_time, end_time })` - Get service metrics
- `list_databases()` - List all databases

---

## 7. tasks

**Purpose:** Task queue management

### Tools

- `create_task_proposal({ title, description, tag, priority, complexity, estimated_hours, ... })` - Create new task
- `get_available_tasks({ status?, tag?, limit? })` - Query tasks
- `approve_task({ task_id })` - Approve suggested task
- `reject_task({ task_id, reason })` - Reject suggested task
- `start_task({ task_id, agent_name })` - Mark task as in progress
- `complete_task({ task_id, summary, agent_name })` - Mark task complete
- `block_task({ task_id, reason, agent_name })` - Mark task as blocked
- `fail_task({ task_id, reason, agent_name })` - Mark task as failed
- `get_task_details({ task_id })` - Get full task information
- `edit_task({ task_id, updates })` - Update task fields
- `request_work_approval({ task_id, work_description })` - Request owner approval for work
- `get_task_run_link({ task_id })` - Get link to task execution

---

## 8. reports

**Purpose:** Business reporting and analytics

### Tools

- `create_report({ title, content, report_type?, tags?, metadata? })` - Save report
- `query_reports({ report_type?, tags?, limit? })` - Search reports
- `get_reports_by_date({ start_date, end_date, report_type? })` - Get reports by date range
- `get_report({ report_id })` - Get specific report
- `search_reports({ query, last_n_days?, limit? })` - Full-text search
- `get_latest_report({ report_type? })` - Get most recent report
- `save_analytics_snapshot({ date, metrics })` - Save daily analytics

---

## 9. documents

**Purpose:** Company knowledge base

### Tools

- `get_company_documents()` - Get all company documents
- `get_company_document({ type })` - Get specific document type
- `update_company_document({ type, content })` - Update document

### Document Types

- `mission` - Company mission and vision
- `product_overview` - Product description and features
- `tech_notes` - Technical architecture notes
- `brand_voice` - Brand voice and messaging guidelines
- `user_research` - User research findings

---

## 10. dashboard

**Purpose:** User dashboard updates

### Tools

- `add_link({ title, url, description? })` - Add link to dashboard
- `get_dashboard()` - Get dashboard state

**Note:** Agent mood updates happen automatically based on thinking patterns (300+ faces available).

---

## 11. company_email

**Purpose:** Company email (@polsia.app addresses)

### Tools

- `get_inbox({ direction?, limit?, offset? })` - Get emails (inbound/outbound)
- `send_company_email({ to, subject, body, is_transactional? })` - Send email (2/day cold, unlimited transactional/replies)
- `get_email_thread({ email_id })` - Get email conversation thread
- `add_contact({ name, email, company?, notes?, status? })` - Add contact to CRM
- `get_contacts({ status?, limit? })` - Get contacts

**Rate Limits:**
- Cold outreach: 2/day
- Replies: unlimited
- Transactional: unlimited

---

## 12. postmark

**Purpose:** Direct transactional email sending

### Tools

- `send_email({ from, to, subject, html_body, text_body? })` - Send email via Postmark

---

## 13. hunter_io

**Purpose:** Email verification and discovery

### Tools

- `find_email({ domain, first_name, last_name })` - Find email address
- `verify_email({ email })` - Verify email deliverability

---

## 14. browserbase

**Purpose:** Headless browser automation

### Tools

- `session_create({ proxy_config? })` - Create browser session
- `navigate({ session_id, url })` - Navigate to URL
- `screenshot({ session_id, selector? })` - Take screenshot
- `click({ session_id, selector })` - Click element
- `fill({ session_id, selector, value })` - Fill form field
- `extract({ session_id, instruction })` - Extract data using AI
- `get_page_content({ session_id, format? })` - Get page HTML/text
- `evaluate({ session_id, script })` - Run JavaScript
- `session_close({ session_id })` - Close session

---

## 15. browser_auth

**Purpose:** Browser authentication management

### Tools

- `get_site_tier({ site })` - Get site tier (1/1.5/2/3) and capabilities
- `get_company_email()` - Get company email for registrations
- `generate_password()` - Generate secure password
- `get_site_credentials({ site })` - Get saved credentials
- `save_site_credentials({ site, username, password, notes? })` - Save credentials
- `check_verification_inbox({ site })` - Check for verification emails
- `verify_credentials({ site, username, password })` - Test credentials
- `list_stored_credentials()` - List all saved credentials
- `get_or_create_browser_context({ site })` - Get persistent browser context
- `list_browser_contexts()` - List all contexts
- `delete_browser_context({ site })` - Delete context

### Site Tiers

**Tier 1** (Browse only - bot detection blocks actions):
- Twitter, X, Instagram, LinkedIn, Facebook, TikTok, Reddit, ProductHunt, IndieHackers, Discord

**Tier 1.5** (Login if credentials exist, cannot create):
- HackerNews, Medium, Dev.to, Gumroad, Etsy, Craigslist

**Tier 2** (Full access, can create accounts):
- Hashnode, Substack, BetaList, Lobste.rs

**Tier 3** (All others - default permissions)

---

## 16. cycle_planning

**Purpose:** Nightly autonomous planning

### Tools

- `get_cycle_context({ include_docs?, include_tasks?, include_memory? })` - Get context for planning
- `create_cycle_plan({ tasks, reasoning })` - Create tonight's plan
- `update_cycle_plan({ cycle_id, updates })` - Update active plan
- `submit_review({ cycle_id, accomplished, failed, tomorrow_priorities })` - Submit cycle results

---

## 17. learnings

**Purpose:** Agent knowledge capture

### Tools

- `create_learning({ title, content, category, tags?, confidence? })` - Save learning
- `query_learnings({ category?, tags?, limit? })` - Query learnings
- `search_learnings({ query, limit? })` - Semantic search
- `get_recent_learnings({ limit?, days? })` - Get recent learnings
- `get_learnings_by_tags({ tags })` - Get by tags

### Categories

- technical, process, business, user_behavior, infrastructure, debugging

---

## 18. agent_factory

**Purpose:** Custom agent creation

### Tools

- `list_mcp_tools()` - List all available MCP tools
- `get_mcp_tool_details({ server_name })` - Get tools for specific server
- `create_agent({ name, system_prompt, mcp_servers, model?, max_turns? })` - Create custom agent
- `list_created_agents()` - List custom agents
- `get_agent_template({ template_type })` - Get agent template

---

## 19. scripts

**Purpose:** Saved script execution

### Tools

- `list_scripts({ category? })` - List available scripts
- `run_script({ script_id, params? })` - Execute script
- `get_script_output({ execution_id })` - Get script results

---

## 20. capabilities

**Purpose:** System introspection

### Tools

- `list_available_modules()` - List all available modules
- `get_module_capabilities({ module_name })` - Get module details
- `list_mcp_servers()` - List all MCP servers
- `list_available_agents()` - List all agent types
- `get_agent_capabilities({ agent_id })` - Get agent's tools and permissions
- `find_agent_for_task({ query })` - Find best agent for task based on historical performance

---

## 21. polsia_support

**Purpose:** Platform issue reporting

### Tools

- `report_platform_bug({ title, description, severity?, reproduction_steps? })` - Report bug to Polsia team
- `suggest_feature({ title, description, use_case? })` - Suggest platform feature

---

## 22. send_reply

**Purpose:** Real-time agent-to-user communication

### Tools

- `send_reply({ message, agent_name? })` - Push message into chat during execution (makes platform feel LIVE)

---

## MCP Mounting Strategy

Agents mount only the MCP servers they need:

| Agent | MCP Servers |
|-------|-------------|
| Engineering | tasks, reports, polsia_infra, polsia_support, stripe, memory, skills |
| Research | tasks, reports, polsia_support, memory, skills |
| Browser | browserbase, browser_auth, company_email, tasks, reports, polsia_support, memory, skills |
| Data | polsia_infra, tasks, reports, polsia_support, memory, skills |
| Support | company_email, gmail, tasks, reports, polsia_support, memory, skills |
| Twitter | twitter, tasks, reports, documents, memory, skills |
| Cold Outreach | company_email, tasks, reports, polsia_support, documents, hunter_io, memory, skills |
| Meta Ads | meta_ads, tasks, reports, memory, skills |

**CEO Module:** Has access to ALL tools (50+ tools total)

---

## Tool Calling Convention

All MCP tools follow this pattern:

```javascript
await mcpClient.callTool('server_name', 'tool_name', {
  param1: value1,
  param2: value2
});
```

Example:
```javascript
await mcpClient.callTool('tasks', 'create_task_proposal', {
  title: "Fix login bug",
  description: "Users can't login...",
  tag: "engineering",
  complexity: 5,
  estimated_hours: 2
});
```

---

## Error Handling

All tools return:
```javascript
{
  success: true/false,
  data?: any,
  error?: string
}
```

Agents should always check `success` before using `data`.
