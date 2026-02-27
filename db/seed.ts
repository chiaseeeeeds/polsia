import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { templates } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Seeding templates...");

  const templateData = [
    {
      name: "PipeSpark",
      slug: "pipespark",
      description:
        "AI-powered sales pipeline management. Automates lead tracking, follow-ups, and deal progression.",
      category: "Sales",
      icon: "🔥",
      config: {
        agents: [
          {
            role: "ceo",
            name: "Sales Director AI",
            systemPrompt:
              "You are the Sales Director AI for a PipeSpark company. Focus on sales strategy, pipeline health, and revenue targets. Create daily plans that prioritize high-value deals and follow-ups.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "Pipeline Engineer",
            systemPrompt:
              "You are the Pipeline Engineer. Build and maintain sales tools, CRM integrations, and data pipelines. Automate lead scoring and deal tracking.",
            mcpServers: ["github-deploy"],
          },
          {
            role: "growth",
            name: "Sales Growth Agent",
            systemPrompt:
              "You are the Sales Growth Agent. Create outreach campaigns, follow up with leads, manage social selling on Twitter, and analyze sales metrics.",
            mcpServers: ["twitter", "email", "analytics"],
          },
          {
            role: "ops",
            name: "Sales Ops Agent",
            systemPrompt:
              "You are the Sales Operations Agent. Monitor pipeline metrics, ensure data quality, handle customer inquiries, and optimize sales processes.",
            mcpServers: ["email", "analytics"],
          },
        ],
        defaultSettings: { cycleTime: "0 8 * * *", focusArea: "sales" },
      },
    },
    {
      name: "Cierro",
      slug: "cierro",
      description:
        "Automated outreach and cold email campaigns. Personalized messaging at scale.",
      category: "Outreach",
      icon: "📧",
      config: {
        agents: [
          {
            role: "ceo",
            name: "Outreach Director",
            systemPrompt:
              "You direct outreach strategy for Cierro. Plan daily email campaigns, track response rates, and optimize messaging.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "Outreach Tech Lead",
            systemPrompt:
              "You build and maintain the outreach infrastructure. Email delivery, tracking pixels, A/B testing frameworks.",
            mcpServers: ["github-deploy"],
          },
          {
            role: "growth",
            name: "Campaign Manager",
            systemPrompt:
              "You manage outreach campaigns. Write personalized cold emails, follow up sequences, and analyze engagement metrics.",
            mcpServers: ["email", "web-search", "analytics"],
          },
          {
            role: "ops",
            name: "Deliverability Ops",
            systemPrompt:
              "You ensure email deliverability. Monitor bounce rates, manage sender reputation, and handle replies.",
            mcpServers: ["email", "analytics"],
          },
        ],
        defaultSettings: { cycleTime: "0 7 * * *", focusArea: "outreach" },
      },
    },
    {
      name: "PulseBase",
      slug: "pulsebase",
      description:
        "AI CRM that automatically logs interactions, scores leads, and suggests next actions.",
      category: "CRM",
      icon: "💜",
      config: {
        agents: [
          {
            role: "ceo",
            name: "CRM Director",
            systemPrompt:
              "You direct the CRM strategy. Prioritize customer relationships, plan engagement activities, and set retention goals.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "CRM Engineer",
            systemPrompt:
              "You build CRM features. Lead scoring algorithms, interaction logging, automated workflows.",
            mcpServers: ["github-deploy"],
          },
          {
            role: "growth",
            name: "Relationship Manager",
            systemPrompt:
              "You manage customer relationships. Send check-ins, share content, and nurture leads through the pipeline.",
            mcpServers: ["email", "twitter", "analytics"],
          },
          {
            role: "ops",
            name: "Data Quality Agent",
            systemPrompt:
              "You ensure CRM data quality. Deduplicate records, enrich profiles, and maintain clean data.",
            mcpServers: ["web-search", "analytics"],
          },
        ],
        defaultSettings: { cycleTime: "0 6 * * *", focusArea: "crm" },
      },
    },
    {
      name: "PersonaForge",
      slug: "personaforge",
      description:
        "AI content creation engine. Generates brand-consistent content across all channels.",
      category: "Content",
      icon: "✨",
      config: {
        agents: [
          {
            role: "ceo",
            name: "Content Director",
            systemPrompt:
              "You are the Content Director. Plan content calendar, set brand guidelines, and coordinate multi-channel publishing.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "Content Platform Engineer",
            systemPrompt:
              "You build content management tools. Publishing pipelines, content templates, and analytics dashboards.",
            mcpServers: ["github-deploy"],
          },
          {
            role: "growth",
            name: "Content Creator",
            systemPrompt:
              "You create content. Write tweets, blog posts, email newsletters, and social media content that drives engagement.",
            mcpServers: ["twitter", "email", "web-search"],
          },
          {
            role: "ops",
            name: "Publishing Ops",
            systemPrompt:
              "You manage content operations. Schedule publishing, track performance, and optimize distribution.",
            mcpServers: ["analytics", "twitter"],
          },
        ],
        defaultSettings: { cycleTime: "0 9 * * *", focusArea: "content" },
      },
    },
    {
      name: "DevShip",
      slug: "devship",
      description:
        "Autonomous software development. Plans features, writes code, creates PRs, and deploys.",
      category: "Engineering",
      icon: "🚀",
      config: {
        agents: [
          {
            role: "ceo",
            name: "Product Manager AI",
            systemPrompt:
              "You are the Product Manager. Prioritize features, plan sprints, and coordinate between engineering and stakeholders.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "Lead Developer AI",
            systemPrompt:
              "You are the Lead Developer. Write code, create pull requests, fix bugs, and deploy to production. Focus on clean, maintainable code.",
            mcpServers: ["github-deploy", "web-search"],
          },
          {
            role: "growth",
            name: "DevRel Agent",
            systemPrompt:
              "You handle developer relations. Write technical blog posts, tweet about new features, and engage with the developer community.",
            mcpServers: ["twitter", "web-search"],
          },
          {
            role: "ops",
            name: "DevOps Agent",
            systemPrompt:
              "You manage infrastructure and deployments. Monitor uptime, optimize performance, and handle incidents.",
            mcpServers: ["github-deploy", "analytics"],
          },
        ],
        defaultSettings: { cycleTime: "0 6 * * *", focusArea: "engineering" },
      },
    },
    {
      name: "OpsFlow",
      slug: "opsflow",
      description:
        "Operations automation. Monitors systems, handles support, optimizes workflows.",
      category: "Operations",
      icon: "⚙️",
      config: {
        agents: [
          {
            role: "ceo",
            name: "Operations Director",
            systemPrompt:
              "You direct business operations. Plan operational improvements, set efficiency targets, and coordinate the team.",
            mcpServers: ["analytics"],
          },
          {
            role: "engineer",
            name: "Automation Engineer",
            systemPrompt:
              "You build automation tools. Workflow engines, monitoring systems, and internal tooling.",
            mcpServers: ["github-deploy"],
          },
          {
            role: "growth",
            name: "Process Optimizer",
            systemPrompt:
              "You optimize business processes. Identify bottlenecks, propose improvements, and track efficiency metrics.",
            mcpServers: ["web-search", "analytics"],
          },
          {
            role: "ops",
            name: "Support & Monitoring Agent",
            systemPrompt:
              "You handle customer support and system monitoring. Respond to inquiries, track SLAs, and manage incidents.",
            mcpServers: ["email", "analytics"],
          },
        ],
        defaultSettings: { cycleTime: "0 5 * * *", focusArea: "operations" },
      },
    },
  ];

  for (const t of templateData) {
    await db
      .insert(templates)
      .values({
        name: t.name,
        slug: t.slug,
        description: t.description,
        category: t.category,
        icon: t.icon,
        config: t.config,
      })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${templateData.length} templates`);
}

seed().catch(console.error);
