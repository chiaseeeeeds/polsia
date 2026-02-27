"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Save } from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  config: unknown;
}

interface AgentConfigProps {
  agent: Agent;
  onSave?: (agentId: string, updates: { systemPrompt: string }) => Promise<void>;
}

export function AgentConfig({ agent, onSave }: AgentConfigProps) {
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(agent.id, { systemPrompt: prompt });
      toast.success(`${agent.name} updated`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          {agent.name}
          <Badge variant="secondary" className="ml-auto">
            {agent.role}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>System Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
        {onSave && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
