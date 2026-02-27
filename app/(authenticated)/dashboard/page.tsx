export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/actions/companies";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { getCompanies } from "@/actions/companies";
import { CompanyCard } from "@/components/company/company-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const [stats, companies] = await Promise.all([
    getDashboardStats(),
    getCompanies(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your autonomous AI companies
          </p>
        </div>
        <Link href="/dashboard/companies/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Company
          </Button>
        </Link>
      </div>

      <StatsCards stats={stats} />

      {companies.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Companies</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        </div>
      )}

      {companies.length === 0 && (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <h3 className="text-lg font-medium">No companies yet</h3>
          <p className="text-muted-foreground mt-1">
            Create your first AI company to get started
          </p>
          <Link href="/dashboard/companies/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Company
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
