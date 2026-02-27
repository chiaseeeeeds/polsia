import { CreateCompanyForm } from "@/components/company/create-company-form";

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Company</h1>
        <p className="text-muted-foreground mt-1">
          Set up a new autonomous AI company
        </p>
      </div>
      <CreateCompanyForm />
    </div>
  );
}
