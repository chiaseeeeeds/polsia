# Onboarding Flow

16-step sequence from signup to first chat. The onboarding creates the foundation for everything - documents, agents, tasks.

---

## Overview

**Goal:** Transform new user from "what is this?" to "I have an autonomous team running my company."

**Duration:** 5-8 minutes

**Completion rate target:** >80%

---

## Steps

### Step 1: Landing Page

**URL:** `/`

**Content:**
- Hero: "Your Autonomous Workforce"
- Subhead: "AI agents that build, market, and run your company. While you sleep."
- CTA: "Start Building" → `/signup`
- Social proof: "43 companies, $2.3M deployed"
- Feature highlights: 8 agents, nightly cycles, real work

**Design:** Premium dark mode, video demo, testimonials

### Step 2: Signup

**URL:** `/signup`

**Fields:**
- Email
- Password (min 8 chars)
- Name

**Validation:**
- Email format
- Password strength
- No duplicate emails

**After submit:**
- Create user account
- Create session
- Redirect to `/onboarding`

### Step 3: Company Name

**URL:** `/onboarding?step=1`

**Question:** "What's your company name?"

**Field:**
- Company name (text input)
- Auto-generates slug (lowercase, hyphenated)
- Shows preview: "acme-corp.polsia.app"

**Next:** Generate slug, create company record

### Step 4: Company Description

**Question:** "What does your company do?"

**Field:**
- Multi-line textarea
- Placeholder: "We help [target customer] [do something] by [unique approach]"
- 2-3 sentences

**Purpose:** Used to generate all documents

### Step 5: Industry

**Question:** "What industry are you in?"

**Options:**
- SaaS
- E-commerce
- Marketplace
- Agency
- Content/Media
- Other (text input)

### Step 6: Stage

**Question:** "Where are you at?"

**Options:**
- Idea stage (no product)
- Building MVP
- Early customers (< 10)
- Growing (10-100 customers)
- Scaling (100+ customers)

**Purpose:** Determines initial task priorities

### Step 7: Website (Optional)

**Question:** "Do you have a website?"

**Field:**
- URL input (optional)
- Validates URL format

**Purpose:** Agents can reference existing site

### Step 8: Goals

**Question:** "What's your top goal right now?"

**Options (single select):**
- Build the product
- Get first customers
- Grow traffic
- Improve product
- Hire team
- Raise funding

**Purpose:** Sets initial cycle focus

### Step 9: Generate Documents

**UI:** Loading screen with progress

**Process:**
1. Call OpenAI API with company info
2. Generate 5 documents:
   - Mission statement
   - Product overview
   - Tech notes (if applicable)
   - Brand voice
   - User research (if customers)
3. Save to database
4. Show brief preview

**Time:** 30-60 seconds

**Progress indicators:**
- "Analyzing your company..."
- "Writing mission statement..."
- "Creating product overview..."
- "Done! 🎉"

### Step 10: Document Review

**UI:** Show generated documents in tabs

**Allow edits:**
- Each document editable
- Save button per document
- "Looks good" button to skip

**Why show this:**
- Builds trust (agents use real data)
- Lets user correct AI mistakes
- Shows capability immediately

### Step 11: Seed Agents

**UI:** Loading screen with agent cards appearing

**Process:**
1. Seed 8 platform agents for this company
2. Each agent card appears with animation
3. Show agent names + capabilities

**Agents seeded:**
- Engineering
- Research
- Browser
- Data
- Support
- Twitter
- Cold Outreach
- Meta Ads

**Time:** 5-10 seconds

### Step 12: Initial Tasks

**UI:** Show suggested tasks

**Process:**
1. Based on stage + goal, create 3-5 starter tasks
2. Show task cards with titles
3. User can approve/reject each
4. "Continue" button

**Example tasks (Idea stage → Build goal):**
- Create landing page
- Set up database
- Build MVP features
- Research competitors

### Step 13: Infrastructure Setup

**UI:** Loading with status updates

**Process:**
1. Call `create_instance({ template: 'express-postgres' })`
2. Show status:
   - "Provisioning GitHub repo..."
   - "Creating database..."
   - "Deploying to Render..."
3. Save instance ID to company

**Time:** 60-90 seconds

**Why do this now:**
- User sees real infrastructure being created
- Engineering agent can start work immediately
- No placeholder data

### Step 14: Subscription

**UI:** Pricing cards

**Plans:**
- **Base:** $29/mo - 1 company, 15 instant tasks/mo
- **Add-ons:** +$29/mo per company or 30-task pack

**Payment:**
- Stripe Checkout
- Free trial: 7 days
- Can skip for now

**After payment:**
- Create subscription record
- Set task credits

### Step 15: Tour

**UI:** Interactive tour of main UI

**Highlights:**
1. "This is the chat - your command center"
2. "Check the dashboard for agent activity"
3. "Tasks queue here"
4. "Agents work autonomously every night"

**5 bubbles, skip button available**

### Step 16: Welcome Chat

**Redirect:** `/chat`

**First message from CEO:**
```
Welcome to Runloop! I'm your CEO - I orchestrate your autonomous workforce.

You have 8 agents ready:
• Engineering - builds and deploys code
• Research - analyzes markets and competitors
• Twitter - manages social presence
• + 5 more

I've queued 3 starter tasks based on your goal: [goal]. They'll run tonight at midnight.

Want me to do something right now? Just ask.
```

**User is now onboarded. 🎉**

---

## Database Changes

### companies table additions

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
```

### Onboarding data structure

```json
{
  "industry": "SaaS",
  "stage": "Building MVP",
  "goal": "Build the product",
  "website": "https://acme.com",
  "completed_at": "2026-03-04T04:00:00Z"
}
```

---

## API Endpoints

### POST /api/onboarding/start
Start onboarding (called after signup).

**Response:**
```json
{
  "success": true,
  "onboarding_id": "uuid",
  "step": 1
}
```

### POST /api/onboarding/step
Submit step data and advance.

**Request:**
```json
{
  "step": 1,
  "data": {
    "company_name": "Acme Corp",
    "slug": "acme-corp"
  }
}
```

**Response:**
```json
{
  "success": true,
  "next_step": 2
}
```

### POST /api/onboarding/generate-documents
Generate company documents.

**Request:**
```json
{
  "company_name": "Acme Corp",
  "description": "We help...",
  "industry": "SaaS",
  "stage": "Building MVP"
}
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "type": "mission",
      "content": "Our mission is to..."
    }
  ]
}
```

### POST /api/onboarding/complete
Mark onboarding complete.

**Response:**
```json
{
  "success": true,
  "redirect": "/chat"
}
```

---

## Document Generation Prompts

### Mission Statement

**Prompt:**
```
Generate a mission statement for a company:

Name: {company_name}
Description: {description}
Industry: {industry}

Requirements:
- 2-3 sentences
- Clear value proposition
- Inspiring but grounded
- No buzzwords or fluff

Output format: Plain text, no title, no formatting.
```

### Product Overview

**Prompt:**
```
Generate a product overview for:

Name: {company_name}
Description: {description}
Industry: {industry}
Stage: {stage}

Requirements:
- What problem it solves
- Who it's for
- How it works
- What makes it unique
- Current status/stage

Output format: Markdown with ## headings.
```

### Tech Notes

**Prompt:**
```
Generate technical notes for:

{company_name} - {description}

Requirements:
- Tech stack (infer from industry)
- Architecture overview
- Key components
- Infrastructure setup

Output format: Markdown with ## headings.
```

### Brand Voice

**Prompt:**
```
Define brand voice for:

{company_name} - {description}

Requirements:
- Tone (formal/casual)
- Language style
- Words to use/avoid
- Example phrases

Output format: Markdown bullet list.
```

### User Research

**Prompt:**
```
Create user research template for:

{company_name} - {description}

Requirements:
- Target customer persona
- Pain points
- Use cases
- Customer feedback (placeholder if none yet)

Output format: Markdown with ## headings.
```

---

## Starter Task Templates

### By Stage + Goal

**Idea → Build:**
1. Create landing page
2. Set up infrastructure
3. Build core features
4. Research competitors

**Building MVP → Build:**
1. Complete MVP features
2. Set up analytics
3. Create signup flow
4. Write documentation

**Building MVP → Get customers:**
1. Polish landing page
2. Set up email capture
3. Launch on ProductHunt
4. Cold outreach campaign

**Early customers → Grow:**
1. Set up analytics
2. Create content strategy
3. Launch Meta ads
4. Improve onboarding

**Growing → Scale:**
1. Optimize database
2. Add team features
3. Create referral program
4. Expand marketing

---

## UI Mockups

### Step 3: Company Name
```
┌────────────────────────────────────────┐
│  [← Back]              Step 1 of 16   │
├────────────────────────────────────────┤
│                                        │
│  What's your company name?             │
│                                        │
│  [Acme Corp________________]           │
│                                        │
│  Your workspace:                       │
│  🌐 acme-corp.polsia.app              │
│                                        │
│                    [Continue →]        │
└────────────────────────────────────────┘
```

### Step 9: Generating Documents
```
┌────────────────────────────────────────┐
│  Setting up your company...            │
├────────────────────────────────────────┤
│                                        │
│  ✓ Company profile created             │
│  ⏳ Writing mission statement...       │
│  ⏸ Creating product overview          │
│  ⏸ Defining brand voice               │
│  ⏸ Setting up tech notes              │
│                                        │
│  [████████░░░░░░] 40%                  │
└────────────────────────────────────────┘
```

### Step 10: Document Review
```
┌────────────────────────────────────────┐
│  Review your company documents         │
├────────────────────────────────────────┤
│  [Mission] [Product] [Tech] [Brand]    │
├────────────────────────────────────────┤
│  ## Mission                            │
│                                        │
│  Our mission is to empower...          │
│                                        │
│  [Edit] [Looks good →]                 │
└────────────────────────────────────────┘
```

---

## Completion Tracking

```javascript
const ONBOARDING_STEPS = [
  'company_name',
  'company_description',
  'industry',
  'stage',
  'website',
  'goals',
  'generate_docs',
  'review_docs',
  'seed_agents',
  'initial_tasks',
  'infrastructure',
  'subscription',
  'tour',
  'complete'
];

function getProgress(step) {
  const current = ONBOARDING_STEPS.indexOf(step);
  return Math.round((current / ONBOARDING_STEPS.length) * 100);
}
```

---

## Drop-off Prevention

**Common drop-off points:**

1. **Document generation (Step 9)** - Takes 30-60s
   - Solution: Engaging progress indicators, show what's happening

2. **Infrastructure setup (Step 13)** - Takes 60-90s
   - Solution: Real-time status updates, explain why this matters

3. **Subscription (Step 14)** - Friction point
   - Solution: Allow skip, offer free trial, show value first

**Recovery:**
- Save progress at every step
- Email reminder if abandoned
- Resume from last step on return

---

## Post-Onboarding

**Immediate actions:**
1. Queue starter tasks (status: 'todo')
2. Schedule first cycle (tonight at midnight)
3. Send welcome email with next steps
4. Add dashboard links (app URL, docs)

**First 24 hours:**
- First cycle runs tonight
- Morning summary email
- Check-in: "How's it going?"

**First week:**
- Review cycle results
- Adjust focus if needed
- Gather feedback

---

## Metrics to Track

- **Completion rate:** % who finish all steps
- **Time to complete:** Median duration
- **Drop-off by step:** Where users abandon
- **Doc generation success:** % without errors
- **Infrastructure success:** % deploys that work
- **Tasks created:** Avg starter tasks approved

**Target metrics:**
- Completion rate: >80%
- Time to complete: <10 min
- Infrastructure success: >95%

---

## Future Enhancements

(Not in V1)

- Skip infrastructure setup (add later)
- Import existing codebase
- Team onboarding (invite members)
- Onboarding customization by industry
- Video walkthrough option
- AI onboarding assistant (chat-based)
