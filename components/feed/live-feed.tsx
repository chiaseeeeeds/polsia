"use client";

import { useSSE } from "@/hooks/use-sse";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentLogEntry, AgentLogType } from "@/types";

const typeConfig: Record<
  AgentLogType,
  { label: string; color: string; icon: string }
> = {
  thought: { label: "Thinking", color: "bg-blue-500/10 text-blue-500", icon: "💭" },
  tool_call: { label: "Tool Call", color: "bg-purple-500/10 text-purple-500", icon: "🔧" },
  tool_result: { label: "Result", color: "bg-gray-500/10 text-gray-500", icon: "📋" },
  deploy: { label: "Deploy", color: "bg-green-500/10 text-green-500", icon: "🚀" },
  social_post: { label: "Social", color: "bg-sky-500/10 text-sky-500", icon: "📱" },
  email_sent: { label: "Email", color: "bg-amber-500/10 text-amber-500", icon: "📧" },
  code_push: { label: "Code", color: "bg-orange-500/10 text-orange-500", icon: "💻" },
  metric: { label: "Metric", color: "bg-emerald-500/10 text-emerald-500", icon: "📊" },
  error: { label: "Error", color: "bg-red-500/10 text-red-500", icon: "❌" },
  plan: { label: "Plan", color: "bg-indigo-500/10 text-indigo-500", icon: "📋" },
  summary: { label: "Summary", color: "bg-teal-500/10 text-teal-500", icon: "✅" },
};

function FeedItem({ log }: { log: AgentLogEntry }) {
  const config = typeConfig[log.type] ?? typeConfig.thought;
  const time = new Date(log.createdAt).toLocaleTimeString();

  return (
    <div className="flex gap-3 p-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
      <span className="text-lg shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm text-foreground/80 break-words line-clamp-3">
          {log.content}
        </p>
      </div>
    </div>
  );
}

export function LiveFeedContainer({ companyId }: { companyId: string }) {
  const { events, connected } = useSSE(companyId);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            connected ? "bg-green-500 animate-pulse" : "bg-gray-400"
          )}
        />
        <h3 className="text-sm font-medium">Live Feed</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {events.length} events
        </span>
      </div>
      <ScrollArea className="h-[500px]">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Waiting for agent activity...
          </div>
        ) : (
          events.map((event) => <FeedItem key={event.id} log={event} />)
        )}
      </ScrollArea>
    </div>
  );
}
