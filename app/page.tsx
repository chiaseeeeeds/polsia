import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingHeader } from "@/components/landing/header";
import {
  Bot,
  Zap,
  BarChart3,
  Code2,
  Megaphone,
  Settings,
  ArrowRight,
  Check,
  Radio,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Coordinated AI Agents",
    description:
      "CEO, Engineer, Growth, and Ops agents work together in automated daily cycles.",
  },
  {
    icon: Zap,
    title: "Daily Autonomous Cycles",
    description:
      "CEO plans, agents execute, results logged. Your company runs itself every day.",
  },
  {
    icon: BarChart3,
    title: "Real-time Metrics",
    description:
      "Track revenue, users, engagement, and operational health in real-time.",
  },
  {
    icon: Code2,
    title: "Code & Deploy",
    description:
      "Engineer agents write code, create PRs, and deploy directly to production.",
  },
  {
    icon: Megaphone,
    title: "Growth & Marketing",
    description:
      "Automated social media posts, email campaigns, and content creation.",
  },
  {
    icon: Settings,
    title: "MCP Tool Ecosystem",
    description:
      "Extensible tool servers for Twitter, Email, GitHub, Search, and Analytics.",
  },
];

const templates = [
  { name: "PipeSpark", category: "Sales", icon: "🔥" },
  { name: "Cierro", category: "Outreach", icon: "📧" },
  { name: "PulseBase", category: "CRM", icon: "💜" },
  { name: "PersonaForge", category: "Content", icon: "✨" },
  { name: "DevShip", category: "Engineering", icon: "🚀" },
  { name: "OpsFlow", category: "Operations", icon: "⚙️" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          500+ companies running autonomously
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto">
          Run Your Company
          <br />
          <span className="text-primary">With AI Agents</span>
        </h1>
        <p className="text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
          Coordinated AI agents handle planning, coding, marketing, and
          operations in automated daily cycles. Your company runs itself.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-8">
              Start Building
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/live">
            <Button size="lg" variant="outline" className="text-lg px-8">
              <Radio className="mr-2 h-5 w-5" />
              Watch Live
            </Button>
          </Link>
        </div>
      </section>

      {/* Live Demo Embed */}
      <section className="container mx-auto px-4 py-12">
        <div className="border rounded-xl bg-muted/30 p-8 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Live Agent Activity</span>
          </div>
          <div className="space-y-3 font-mono text-sm">
            {[
              { type: "CEO", action: "Planning daily cycle for TechStartup Inc..." },
              { type: "Engineer", action: "Deploying v2.3.1 to production..." },
              { type: "Growth", action: "Posted tweet: 'Excited to announce our new API...'" },
              { type: "Ops", action: "System health check passed. Uptime: 99.9%" },
              { type: "CEO", action: "Cycle complete. 4 agents ran, 12 tasks completed." },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 text-muted-foreground">
                <Badge variant="outline" className="shrink-0">
                  {item.type}
                </Badge>
                <span>{item.action}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Run an Autonomous Company
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Create a Company",
                description:
                  "Start from scratch or use a template. Configure your agents and tools.",
              },
              {
                step: "2",
                title: "Agents Execute Daily",
                description:
                  "CEO plans, Engineer codes, Growth markets, Ops manages — all automatically.",
              },
              {
                step: "3",
                title: "Watch & Scale",
                description:
                  "Monitor real-time activity, track metrics, and scale to multiple companies.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">
          Pre-Built Templates
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Launch faster with pre-configured company templates
        </p>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 max-w-5xl mx-auto">
          {templates.map((t) => (
            <Card key={t.name} className="text-center hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <span className="text-3xl">{t.icon}</span>
                <h3 className="font-medium mt-2">{t.name}</h3>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {t.category}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/30 py-24" id="pricing">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Simple Pricing
          </h2>
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <h3 className="font-bold text-2xl">Pro Plan</h3>
              <div className="mt-4">
                <span className="text-5xl font-bold">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-left">
                {[
                  "Unlimited AI companies",
                  "4 agent roles per company",
                  "Automated daily cycles",
                  "Full MCP tool ecosystem",
                  "Real-time live feed",
                  "Metrics & analytics",
                  "6 pre-built templates",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button size="lg" className="w-full mt-8">
                  Get Started
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            <span className="font-semibold">Polsia</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Autonomous AI platform for running companies
          </p>
        </div>
      </footer>
    </div>
  );
}
