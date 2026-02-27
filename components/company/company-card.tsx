"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/types";

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
  };
}

const statusColors: Record<CompanyStatus, string> = {
  active: "bg-green-500/10 text-green-500",
  paused: "bg-yellow-500/10 text-yellow-500",
  archived: "bg-gray-500/10 text-gray-500",
};

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <Link href={`/dashboard/companies/${company.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-lg">{company.name}</CardTitle>
          <Badge
            variant="secondary"
            className={cn(statusColors[company.status as CompanyStatus] ?? statusColors.active)}
          >
            {company.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {company.description ?? "No description"}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Created {new Date(company.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
