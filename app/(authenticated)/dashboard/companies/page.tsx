export const dynamic = "force-dynamic";

import { getCompanies } from "@/actions/companies";
import { CompanyCard } from "@/components/company/company-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground mt-1">
            All your autonomous AI companies
          </p>
        </div>
        <Link href="/dashboard/companies/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Company
          </Button>
        </Link>
      </div>

      {companies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <h3 className="text-lg font-medium">No companies yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Create your first AI company or start from a template
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/companies/new">
              <Button>Create from Scratch</Button>
            </Link>
            <Link href="/dashboard/templates">
              <Button variant="outline">Browse Templates</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
