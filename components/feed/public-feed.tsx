"use client";

import { usePublicSSE } from "@/hooks/use-sse";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentLogEntry, AgentLogType } from "@/types";

const typeConfig: Record<string, { label: string; color: string }> = {
  thought: { label: "Thinking", color: "text-blue-500" },
  tool_call: { label: "Tool", color: "text-purple-500" },
  tool_result: { label: "Result", color: "text-gray-500" },
  deploy: { label: "Deploy", color: "text-green-500" },
  social_post: { label: "Social", color: "text-sky-500" },
  email_sent: { label: "Email", color: "text-amber-500" },
  code_push: { label: "Code", color: "text-orange-500" },
  metric: { label: "Metric", color: "text-emerald-500" },
  error: { label: "Error", color: "text-red-500" },
  plan: { label: "Plan", color: "text-indigo-500" },
  summary: { label: "Summary", color: "text-teal-500" },
};

function PublicFeedItem({ log }: { log: AgentLogEntry }) {
  const config = typeConfig[log.type] ?? typeConfig.thought;
  const time = new Date(log.createdAt).toLocaleTimeString();

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors">
      <div
        className={cn(
          "w-1 shrink-0 rounded-full",
          config.color.replace("text-", "bg-")
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm text-foreground/70 break-words line-clamp-2">
          {log.content}
        </p>
      </div>
    </div>
  );
}

export function PublicLiveFeed() {
  const { events, connected } = usePublicSSE();

  return (
    <div className="border rounded-xl overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-6 py-4 border-b">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full",
            connected ? "bg-green-500 animate-pulse" : "bg-gray-400"
          )}
        />
        <h2 className="font-semibold">Live Agent Activity</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {connected ? "Connected" : "Connecting..."} &middot; {events.length} events
        </span>
      </div>
      <ScrollArea className="h-[600px]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse mb-4" />
            <p className="text-sm">Waiting for agent activity...</p>
            <p className="text-xs mt-1">Events will appear here in real-time</p>
          </div>
        ) : (
          events.map((event) => <PublicFeedItem key={event.id} log={event} />)
        )}
      </ScrollArea>
    </div>
  );
}
