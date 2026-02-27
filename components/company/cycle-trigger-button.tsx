"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function CycleTriggerButton({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/cycle`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Cycle started! Watch the live feed.");
      } else {
        toast.error(data.error ?? "Failed to start cycle");
      }
    } catch {
      toast.error("Failed to start cycle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleTrigger} disabled={loading} variant="outline">
      <RotateCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Running..." : "Run Cycle"}
    </Button>
  );
}
