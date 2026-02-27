"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Bot, RotateCcw, Zap } from "lucide-react";

interface StatsCardsProps {
  stats: {
    companies: number;
    activeAgents: number;
    cyclesToday: number;
    tokensUsed: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Companies",
      value: stats.companies,
      icon: Building2,
      description: "Active AI companies",
    },
    {
      title: "Active Agents",
      value: stats.activeAgents,
      icon: Bot,
      description: "Deployed agents",
    },
    {
      title: "Cycles Today",
      value: stats.cyclesToday,
      icon: RotateCcw,
      description: "Completed today",
    },
    {
      title: "Tokens Used",
      value: stats.tokensUsed.toLocaleString(),
      icon: Zap,
      description: "Total consumption",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
