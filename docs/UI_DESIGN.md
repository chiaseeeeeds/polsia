# UI Design System

Premium dark-mode design that screams "$10M venture backing." Think Linear × Vercel × Arc.

---

## Design Philosophy

**This is NOT a chatbot wrapper. It's a premium B2B SaaS product.**

Users should feel:
- "This looks expensive"
- "I'm in a command center"
- "This is serious software"
- "Nothing like typical AI chat tools"

---

## Color Palette

### Dark Mode (Default)

**Backgrounds:**
```css
--bg-darkest: #0a0a0a;    /* App background */
--bg-darker: #141414;      /* Card background */
--bg-dark: #1a1a1a;        /* Elevated surfaces */
--bg-medium: #242424;      /* Hover states */
```

**Accents:**
```css
--purple: #8B5CF6;         /* Primary brand */
--purple-dark: #7C3AED;    /* Hover */
--purple-light: #A78BFA;   /* Light variant */

--blue: #3B82F6;           /* Secondary */
--blue-dark: #2563EB;

--teal: #14B8A6;           /* Success */
--green: #10B981;

--red: #EF4444;            /* Error/critical */
--orange: #F97316;         /* Warning */
--yellow: #EAB308;         /* Caution */
```

**Text:**
```css
--text-primary: #F9FAFB;   /* Headlines */
--text-secondary: #D1D5DB; /* Body */
--text-tertiary: #9CA3AF;  /* Muted */
--text-disabled: #6B7280;  /* Disabled */
```

**Borders:**
```css
--border-subtle: rgba(255, 255, 255, 0.06);
--border-medium: rgba(255, 255, 255, 0.1);
--border-strong: rgba(255, 255, 255, 0.2);
```

**Gradients:**
```css
--gradient-primary: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
--gradient-accent: linear-gradient(135deg, #3B82F6 0%, #14B8A6 100%);
--gradient-subtle: linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
```

---

## Typography

### Font Stack

**Primary:** Inter (body text, UI elements)
**Display:** Satoshi (headlines, numbers)
**Mono:** JetBrains Mono (code, logs)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}
```

### Type Scale

```css
--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 40px;
```

### Font Weights

```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

---

## Spacing System

**8px base unit**

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
```

---

## Components

### Buttons

**Primary:**
```css
.btn-primary {
  background: var(--gradient-primary);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}
```

**Secondary:**
```css
.btn-secondary {
  background: var(--bg-medium);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--border-strong);
  background: var(--bg-dark);
}
```

**Ghost:**
```css
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  background: var(--bg-medium);
  color: var(--text-primary);
}
```

### Cards

**Base card:**
```css
.card {
  background: var(--bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;
}

.card:hover {
  border-color: var(--border-medium);
  transform: translateY(-2px);
}
```

**Glass card:**
```css
.card-glass {
  background: rgba(26, 26, 26, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px;
}
```

### Inputs

```css
.input {
  background: var(--bg-darker);
  border: 1px solid var(--border-medium);
  color: var(--text-primary);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  width: 100%;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.input::placeholder {
  color: var(--text-disabled);
}
```

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--yellow);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
```

### Agent Cards

```css
.agent-card {
  background: var(--bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  transition: all 0.3s ease;
}

.agent-card:hover {
  border-color: var(--purple);
  background: var(--bg-dark);
}

.agent-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

/* Pulse animation when agent is active */
.agent-card.active .agent-avatar {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
  }
}
```

---

## Micro-Animations

### Page Transitions

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: fadeIn 0.3s ease-out;
}
```

### Skeleton Loading

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-darker) 0%,
    var(--bg-dark) 50%,
    var(--bg-darker) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

### Button Hover

```css
.btn:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.btn:active {
  transform: translateY(0);
}
```

---

## Layout Patterns

### Sidebar + Main Content

```
┌────────────────────────────────────────┐
│ [Logo]                          [User] │ Header (60px)
├────────────────────────────────────────┤
│ [Sidebar] │ [Main Content Area]        │
│  (260px)  │                            │
│           │                            │
│           │                            │
│           │                            │
└────────────────────────────────────────┘
```

### Chat Interface

```
┌────────────────────────────────────────┐
│ [Conversations]  │  [Chat Messages]    │
│   Sidebar        │                     │
│   (300px)        │  [Input Box]        │
│                  │  (Bottom fixed)     │
└────────────────────────────────────────┘
```

### Dashboard Grid

```
┌──────────────┬──────────────┬──────────────┐
│ Metric Card  │ Metric Card  │ Metric Card  │
├──────────────┴──────────────┴──────────────┤
│          Activity Feed (Full Width)        │
├────────────────────────┬───────────────────┤
│  Task Queue (60%)      │  Agents (40%)     │
└────────────────────────┴───────────────────┘
```

---

## Specific UI Elements

### Chat Message

```html
<div class="message user">
  <div class="message-content">
    <p>Fix the login button</p>
  </div>
  <div class="message-meta">
    <span>You</span>
    <span>2:30 PM</span>
  </div>
</div>

<div class="message assistant">
  <div class="message-avatar">
    🤖
  </div>
  <div class="message-content">
    <p>Creating task for Engineering.</p>
    <div class="tool-call">
      <span class="tool-icon">⚙️</span>
      <span class="tool-name">create_task_proposal</span>
      <span class="tool-status success">✓</span>
    </div>
  </div>
  <div class="message-meta">
    <span>CEO</span>
    <span>2:30 PM</span>
  </div>
</div>
```

**Styling:**
```css
.message {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.message.user {
  background: var(--bg-darker);
}

.message.assistant {
  background: transparent;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tool-call {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-dark);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
}

.tool-status.success {
  color: var(--green);
}
```

### Task Card

```html
<div class="task-card priority-high">
  <div class="task-header">
    <span class="task-priority">🔴</span>
    <h3 class="task-title">Fix login button</h3>
    <span class="task-tag">engineering</span>
  </div>
  <p class="task-description">Login button has wrong color...</p>
  <div class="task-footer">
    <div class="task-meta">
      <span>⏱️ 0.5h</span>
      <span>🎯 Complexity: 3</span>
    </div>
    <div class="task-agent">
      <img src="/agent/30" alt="Engineering" />
      <span>Engineering</span>
    </div>
  </div>
</div>
```

**Styling:**
```css
.task-card {
  background: var(--bg-darker);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--purple);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-card.priority-critical {
  border-left-color: var(--red);
}

.task-card.priority-high {
  border-left-color: var(--orange);
}

.task-card:hover {
  border-color: var(--border-medium);
  transform: translateX(4px);
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.task-tag {
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--purple-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Agent Status Indicator

```html
<div class="agent-status">
  <div class="status-dot active"></div>
  <span>Working</span>
</div>
```

**Styling:**
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.active {
  background: var(--green);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  animation: pulse-dot 2s ease-in-out infinite;
}

.status-dot.idle {
  background: var(--text-disabled);
}

@keyframes pulse-dot {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}
```

---

## Icons

**Use Lucide icons** (clean, consistent, open-source)

```html
<link rel="stylesheet" href="https://unpkg.com/lucide-static@latest/font/lucide.css">
```

**Common icons:**
- `lucide-message-square` - Chat
- `lucide-check-circle` - Completed
- `lucide-clock` - Pending
- `lucide-alert-circle` - Failed
- `lucide-zap` - Active
- `lucide-settings` - Settings
- `lucide-users` - Agents
- `lucide-briefcase` - Tasks

---

## Mobile Responsive

**Breakpoints:**
```css
@media (max-width: 640px) { /* Mobile */ }
@media (max-width: 768px) { /* Tablet */ }
@media (max-width: 1024px) { /* Small desktop */ }
@media (min-width: 1280px) { /* Large desktop */ }
```

**Mobile navigation:**
- Hamburger menu
- Bottom tab bar for primary actions
- Collapsible sidebar
- Swipe gestures for navigation

---

## Performance Optimizations

1. **CSS containment:**
```css
.card {
  contain: layout style paint;
}
```

2. **Will-change for animations:**
```css
.btn:hover {
  will-change: transform;
}
```

3. **Lazy load images:**
```html
<img loading="lazy" src="..." alt="...">
```

4. **Font optimization:**
```css
@font-face {
  font-family: 'Inter';
  font-display: swap; /* Prevent FOIT */
}
```

---

## Dark Mode ONLY

**No light mode in V1.** Dark mode is the brand.

Reasons:
- Premium aesthetic
- Developer-focused audience prefers dark
- Easier to maintain one theme
- Differentiation from competitors

---

## Inspiration References

**Linear** - Task cards, keyboard shortcuts, smooth animations
**Vercel** - Dashboard layout, metric cards, deployment logs
**Arc** - Sidebar design, color palette, micro-interactions
**Raycast** - Command palette, instant feedback, keyboard-first

---

## Implementation Notes

### Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-darkest': '#0a0a0a',
        'bg-darker': '#141414',
        'bg-dark': '#1a1a1a',
        'bg-medium': '#242424',
        'purple': '#8B5CF6',
        'purple-dark': '#7C3AED',
        // ... all colors
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

### Global CSS

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-darkest);
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Smooth scroll */
html {
  scroll-behavior: smooth;
}

/* Selection */
::selection {
  background: rgba(139, 92, 246, 0.3);
  color: var(--text-primary);
}
```

---

## Design Checklist

Every component should have:
- [ ] Hover state
- [ ] Active/pressed state
- [ ] Loading state (skeleton or spinner)
- [ ] Error state
- [ ] Empty state (if applicable)
- [ ] Mobile responsive layout
- [ ] Smooth transitions (0.2s ease)
- [ ] Proper focus states (keyboard navigation)
- [ ] Accessible contrast ratios

---

## Future Enhancements

(Not in V1)

- Light mode
- Custom themes per company
- Accessibility mode (high contrast)
- Animation preferences (reduced motion)
- Font size customization
