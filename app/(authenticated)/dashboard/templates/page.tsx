export const dynamic = "force-dynamic";

import { getTemplates } from "@/actions/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const defaultTemplates = [
  {
    slug: "pipespark",
    name: "PipeSpark",
    description: "AI-powered sales pipeline management. Automates lead tracking, follow-ups, and deal progression.",
    category: "Sales",
    icon: "🔥",
  },
  {
    slug: "cierro",
    name: "Cierro",
    description: "Automated outreach and cold email campaigns. Personalized messaging at scale.",
    category: "Outreach",
    icon: "📧",
  },
  {
    slug: "pulsebase",
    name: "PulseBase",
    description: "AI CRM that automatically logs interactions, scores leads, and suggests next actions.",
    category: "CRM",
    icon: "💜",
  },
  {
    slug: "personaforge",
    name: "PersonaForge",
    description: "AI content creation engine. Generates brand-consistent content across all channels.",
    category: "Content",
    icon: "✨",
  },
  {
    slug: "devship",
    name: "DevShip",
    description: "Autonomous software development. Plans features, writes code, creates PRs, and deploys.",
    category: "Engineering",
    icon: "🚀",
  },
  {
    slug: "opsflow",
    name: "OpsFlow",
    description: "Operations automation. Monitors systems, handles support, optimizes workflows.",
    category: "Operations",
    icon: "⚙️",
  },
];

export default async function TemplatesPage() {
  const dbTemplates = await getTemplates();

  const templates = dbTemplates.length > 0
    ? dbTemplates.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon ?? "📦",
      }))
    : defaultTemplates;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates</h1>
        <p className="text-muted-foreground mt-1">
          Start with a pre-built company configuration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.slug} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {template.category}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {template.description}
              </p>
              <Link href={`/dashboard/companies/new?template=${template.slug}`}>
                <Button variant="outline" size="sm" className="w-full">
                  Use Template
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
