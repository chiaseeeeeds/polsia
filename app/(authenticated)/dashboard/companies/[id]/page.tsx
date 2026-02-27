export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCompany, getCompanyAgents, getCompanyLogs, getCompanyCycles, getCompanyMetrics } from "@/actions/companies";
import { LiveFeedContainer } from "@/components/feed/live-feed";
import { CycleTriggerButton } from "@/components/company/cycle-trigger-button";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Clock, Zap } from "lucide-react";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [company, companyAgents, logs, cycles, companyMetrics] = await Promise.all([
    getCompany(id),
    getCompanyAgents(id),
    getCompanyLogs(id),
    getCompanyCycles(id),
    getCompanyMetrics(id),
  ]);

  if (!company) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{company.name}</h1>
          {company.description && (
            <p className="text-muted-foreground mt-1">{company.description}</p>
          )}
        </div>
        <CycleTriggerButton companyId={company.id} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyAgents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cycles
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cycles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cycles.reduce((sum, c) => sum + (c.tokensUsed ?? 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Live Feed</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          <LiveFeedContainer companyId={company.id} />
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {companyAgents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    {agent.name}
                    <Badge variant="secondary" className="ml-auto">
                      {agent.role}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.systemPrompt}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Cycles: {agent.totalCycles}</span>
                    <span>Tokens: {(agent.totalTokens ?? 0).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cycles" className="mt-4">
          <div className="space-y-3">
            {cycles.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No cycles yet. Click &quot;Run Cycle&quot; to start the first one.
              </p>
            ) : (
              cycles.map((cycle) => (
                <Card key={cycle.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge
                          variant={
                            cycle.status === "completed"
                              ? "default"
                              : cycle.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {cycle.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground ml-3">
                          {new Date(cycle.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(cycle.tokensUsed ?? 0).toLocaleString()} tokens
                      </span>
                    </div>
                    {cycle.summary && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        {cycle.summary}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsChart metrics={companyMetrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
