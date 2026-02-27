"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MetricDataPoint {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  source: string | null;
  recordedAt: Date;
}

interface MetricsChartProps {
  metrics: MetricDataPoint[];
}

export function MetricsChart({ metrics }: MetricsChartProps) {
  // Group metrics by name
  const grouped: Record<string, MetricDataPoint[]> = {};
  for (const m of metrics) {
    if (!grouped[m.name]) grouped[m.name] = [];
    grouped[m.name].push(m);
  }

  const metricNames = Object.keys(grouped);

  if (metricNames.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No metrics recorded yet. Metrics will appear after running cycles.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {metricNames.map((name) => {
        const dataPoints = grouped[name].sort(
          (a, b) =>
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        );
        const latest = dataPoints[dataPoints.length - 1];
        const previous = dataPoints.length > 1 ? dataPoints[dataPoints.length - 2] : null;
        const change = previous ? latest.value - previous.value : 0;
        const changePercent =
          previous && previous.value !== 0
            ? ((change / previous.value) * 100).toFixed(1)
            : null;

        // Simple sparkline with CSS bars
        const max = Math.max(...dataPoints.map((d) => d.value));
        const min = Math.min(...dataPoints.map((d) => d.value));
        const range = max - min || 1;

        return (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground capitalize">
                {name.replace(/_/g, " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">
                  {latest.value.toLocaleString()}
                </span>
                {latest.unit && (
                  <span className="text-sm text-muted-foreground mb-0.5">
                    {latest.unit}
                  </span>
                )}
                {changePercent && (
                  <Badge
                    variant="secondary"
                    className={`ml-auto ${change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {change >= 0 ? "+" : ""}
                    {changePercent}%
                  </Badge>
                )}
              </div>

              {/* Sparkline */}
              <div className="flex items-end gap-0.5 h-12 mt-4">
                {dataPoints.slice(-20).map((dp, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/30 rounded-t-sm min-w-[3px] transition-all"
                    style={{
                      height: `${((dp.value - min) / range) * 100}%`,
                      minHeight: "4px",
                    }}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {dataPoints.length} data points
                {latest.source && ` \u00B7 Source: ${latest.source}`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
