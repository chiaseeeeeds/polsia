export type AgentRole = "ceo" | "engineer" | "growth" | "ops";

export type CycleStatus = "pending" | "running" | "completed" | "failed";

export type CompanyStatus = "active" | "paused" | "archived";

export type MembershipTier = "free" | "pro" | "enterprise";

export type AgentLogType =
  | "thought"
  | "tool_call"
  | "tool_result"
  | "deploy"
  | "social_post"
  | "email_sent"
  | "code_push"
  | "metric"
  | "error"
  | "plan"
  | "summary";

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  mcpServers?: string[];
  schedule?: string; // cron expression
}

export interface CyclePlan {
  goals: string[];
  assignments: Partial<Record<AgentRole, string[]>>;
}

export interface AgentLogEntry {
  id: string;
  agentId: string;
  cycleId: string;
  companyId: string;
  type: AgentLogType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SSEEvent {
  type: "log" | "cycle_start" | "cycle_end" | "heartbeat";
  data: AgentLogEntry | { cycleId: string; status: string };
}

export interface TemplateConfig {
  name: string;
  description: string;
  category: string;
  agents: {
    role: AgentRole;
    systemPrompt: string;
    mcpServers: string[];
  }[];
  defaultSettings: Record<string, unknown>;
}
