# Subscription & Billing

Stripe-based subscription system with simple pricing model.

---

## Pricing Model

### Base Plan: $29/mo

**Includes:**
- 1 company
- 8 agents (all platform agents)
- Daily autonomous cycles
- 15 instant tasks per month
- Email support

### Add-Ons: +$29/mo each

**Options:**
1. **+Company** - Add another company (runs independently)
2. **+Task Pack** - Add 30 instant tasks/month

**Examples:**
- Base only: $29/mo (1 company, 15 instant tasks)
- Base + 1 company: $58/mo (2 companies, 15 tasks each)
- Base + 2 task packs: $87/mo (1 company, 75 instant tasks)
- Base + 2 companies + 1 pack: $116/mo (3 companies, 45 tasks total)

---

## Database Schema

```sql
CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  plan TEXT NOT NULL DEFAULT 'base' CHECK (plan IN ('base', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'suspended')),

  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Add-ons
  extra_companies INT DEFAULT 0,
  extra_task_packs INT DEFAULT 0,

  -- Credits
  instant_tasks_remaining INT DEFAULT 15,
  instant_tasks_used INT DEFAULT 0,

  -- Billing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

---

## Stripe Integration

### Products & Prices

**Create in Stripe Dashboard:**

1. **Base Plan** - Recurring monthly
   - Product ID: `prod_base`
   - Price: $29/mo

2. **Company Add-On** - Recurring monthly
   - Product ID: `prod_company_addon`
   - Price: $29/mo

3. **Task Pack Add-On** - Recurring monthly
   - Product ID: `prod_task_pack`
   - Price: $29/mo

### Checkout Flow

```javascript
// User clicks "Upgrade"
const session = await stripe.checkout.sessions.create({
  customer: subscription.stripe_customer_id,
  mode: 'subscription',
  line_items: [
    {
      price: 'price_base',
      quantity: 1
    },
    {
      price: 'price_company_addon',
      quantity: extraCompanies
    },
    {
      price: 'price_task_pack',
      quantity: extraTaskPacks
    }
  ],
  success_url: 'https://runloop.polsia.app/settings?success=true',
  cancel_url: 'https://runloop.polsia.app/settings?canceled=true'
});

res.redirect(session.url);
```

### Webhooks

**Handle these events:**

```javascript
// webhook endpoint: /api/stripe/webhook
app.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
  }

  res.json({ received: true });
});
```

---

## Instant Tasks System

### How It Works

**Monthly credits:**
- Base plan: 15 tasks/mo
- Each task pack: +30 tasks/mo
- Resets on billing cycle start

**Usage:**
```javascript
// User runs instant task
if (subscription.instant_tasks_remaining > 0) {
  // Deduct credit
  await db.query(`
    UPDATE subscriptions
    SET instant_tasks_remaining = instant_tasks_remaining - 1,
        instant_tasks_used = instant_tasks_used + 1
    WHERE user_id = $1
  `, [userId]);

  // Execute task immediately
  await executeTaskNow(taskId);
} else {
  throw new Error('No instant tasks remaining. Upgrade or wait for cycle.');
}
```

**Reset on billing cycle:**
```javascript
// Stripe webhook: invoice.payment_succeeded
async function handlePaymentSucceeded(invoice) {
  const subscription = await getSubscriptionByStripeId(invoice.subscription);

  // Reset credits
  const baseCredit = 15;
  const packCredit = subscription.extra_task_packs * 30;

  await db.query(`
    UPDATE subscriptions
    SET instant_tasks_remaining = $1,
        instant_tasks_used = 0,
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '1 month'
    WHERE id = $2
  `, [baseCredit + packCredit, subscription.id]);
}
```

---

## UI: Pricing Page

**Location:** `/pricing`

```
┌────────────────────────────────────────────┐
│  Simple, transparent pricing               │
├────────────────────────────────────────────┤
│                                            │
│  Base Plan - $29/mo                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
│  ✓ 1 company                               │
│  ✓ 8 autonomous agents                     │
│  ✓ Daily progress cycles                   │
│  ✓ 15 instant tasks/month                  │
│                                            │
│  [Start Free Trial]                        │
│                                            │
│  ── Add-Ons (+$29/mo each) ──              │
│                                            │
│  [+] Company - Run another company         │
│  [+] Task Pack - 30 instant tasks          │
│                                            │
│  Need more? Contact us for Enterprise.    │
└────────────────────────────────────────────┘
```

---

## UI: Settings (Subscription)

**Location:** `/settings` (Subscription tab)

```
┌────────────────────────────────────────────┐
│  Current Plan: Base + 2 Task Packs        │
│  $87/mo • Renews Apr 1, 2026               │
├────────────────────────────────────────────┤
│  Base Plan             $29/mo              │
│  Task Pack x2          $58/mo              │
│  ────────────────────────────              │
│  Total                 $87/mo              │
│                                            │
│  Credits:                                  │
│  ⚡ 58 instant tasks remaining this cycle  │
│  🔄 Resets on Apr 1                        │
│                                            │
│  [Manage Add-Ons]  [Cancel Subscription]   │
└────────────────────────────────────────────┘
```

**Manage Add-Ons Modal:**
```
┌────────────────────────────────────────────┐
│  Manage Add-Ons                            │
├────────────────────────────────────────────┤
│  Companies: [▼] [▲] 0  (+$29/mo each)      │
│  Task Packs: [▼] [▲] 2  (+$29/mo each)    │
│                                            │
│  New monthly cost: $87/mo                  │
│  Changes apply immediately.                │
│                                            │
│  [Cancel] [Save Changes]                   │
└────────────────────────────────────────────┘
```

---

## Free Trial

### 7-Day Trial

**On signup:**
- User creates account
- Gets 7-day free trial
- Full access to all features
- No credit card required (optional)

**Trial expiration:**
```javascript
// Check on login
if (subscription.status === 'trialing' && subscription.trial_end < NOW()) {
  subscription.status = 'expired';
  // Restrict access
  // Prompt to subscribe
}
```

**Trial banner:**
```
┌────────────────────────────────────────────┐
│  ⏰ 3 days left in your free trial         │
│  [Upgrade Now] [Dismiss]                   │
└────────────────────────────────────────────┘
```

---

## Referral Program

### How It Works

**Referrer gets:** $10 credit (1 month of add-on)
**Referred gets:** 20% off first month

### Database

```sql
CREATE TABLE referrals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_user_id BIGINT NOT NULL REFERENCES users(id),
  referred_user_id BIGINT REFERENCES users(id), -- NULL until they sign up

  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'paid')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
```

### UI: Referral Link

**Location:** Menu → "Refer a Friend"

```
┌────────────────────────────────────────────┐
│  Refer a Friend                            │
├────────────────────────────────────────────┤
│  Give $5, get $10 credit                   │
│                                            │
│  Your referral link:                       │
│  [https://runloop.polsia.app/r/ABC123]    │
│  [Copy Link]                               │
│                                            │
│  Referrals:                                │
│  • John (completed) - $10 credit           │
│  • Jane (pending)                          │
│                                            │
│  Total credits: $10                        │
└────────────────────────────────────────────┘
```

---

## API Endpoints

### GET /api/subscription
Get current subscription.

**Response:**
```json
{
  "subscription": {
    "plan": "base",
    "status": "active",
    "extra_companies": 0,
    "extra_task_packs": 2,
    "instant_tasks_remaining": 58,
    "monthly_cost": 87,
    "current_period_end": "2026-04-01T00:00:00Z"
  }
}
```

### POST /api/subscription/checkout
Create Stripe checkout session.

**Request:**
```json
{
  "extra_companies": 0,
  "extra_task_packs": 2
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### POST /api/subscription/portal
Create Stripe customer portal session (for managing subscription).

**Response:**
```json
{
  "portal_url": "https://billing.stripe.com/..."
}
```

### POST /api/subscription/cancel
Cancel subscription (at end of period).

**Response:**
```json
{
  "success": true,
  "cancels_at": "2026-04-01T00:00:00Z"
}
```

---

## Subscription States

### active

User has paid, full access.

### trialing

Free trial period, full access.

### past_due

Payment failed, grace period (3 days).

**Restrictions:**
- Can't run instant tasks
- Can't create new companies
- Cycles still run (grace period)

### cancelled

User cancelled, still has access until period end.

### expired

Trial or subscription ended, no payment.

**Restrictions:**
- Read-only access
- Can't create tasks
- Can't run cycles
- Prompt to resubscribe

---

## Payment Failure Handling

### Grace Period

**3 days after payment failure:**

Day 1:
- Email: "Payment failed. Please update card."
- Banner in app
- Still has access

Day 2:
- Second email reminder
- Restrict instant tasks
- Cycles still run

Day 3:
- Final email
- No instant tasks
- Cycles paused

Day 4:
- Subscription suspended
- Read-only access
- Prompt to update payment

### Recovery

```javascript
// User updates payment method
// Stripe retries charge
// Webhook: invoice.payment_succeeded
await db.query(`
  UPDATE subscriptions
  SET status = 'active'
  WHERE stripe_subscription_id = $1
`, [stripeSubscriptionId]);

// Resume full access
```

---

## Enterprise Plan

**Custom pricing** for:
- 10+ companies
- Unlimited instant tasks
- Priority support
- Custom agent development
- White-label option
- SLA guarantees

**Contact:** enterprise@runloop.com

---

## Metrics to Track

- **MRR** - Monthly recurring revenue
- **Churn rate** - % cancellations per month
- **LTV** - Lifetime value per customer
- **Add-on attach rate** - % with add-ons
- **Instant task usage** - Avg tasks used per cycle
- **Failed payments** - % of failed charges
- **Referral conversion** - % referrals that subscribe

**Goals:**
- Churn <5% monthly
- Add-on attach rate >40%
- Instant task usage 60-80% (not too low, not hitting limit)

---

## Future Enhancements

(Not in V1)

- Annual billing (2 months free)
- Team plans (multiple users per company)
- Usage-based pricing (pay per task)
- Credits system (buy task packs without subscription)
- Stripe Tax integration (automatic tax calculation)
- Invoicing for enterprise
