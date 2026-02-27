export const dynamic = "force-dynamic";

import { getCustomer } from "@/actions/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Check } from "lucide-react";

export default async function BillingPage() {
  const customer = await getCustomer();

  const isPro = customer?.membershipTier === "pro";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Badge variant={isPro ? "default" : "secondary"} className="text-lg px-4 py-1">
              {isPro ? "Pro" : "Free"}
            </Badge>
            {isPro && (
              <span className="text-muted-foreground">$49/month</span>
            )}
          </div>

          {!isPro && (
            <div className="space-y-4">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-xl mb-1">Pro Plan — $49/mo</h3>
                <p className="text-muted-foreground mb-4">
                  Everything you need to run autonomous AI companies
                </p>
                <ul className="space-y-2 mb-6">
                  {[
                    "Unlimited AI companies",
                    "All agent roles (CEO, Engineer, Growth, Ops)",
                    "Daily automated cycles",
                    "Full MCP tool ecosystem",
                    "Real-time live feed",
                    "Metrics & analytics dashboard",
                    "Priority support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button size="lg">Upgrade to Pro</Button>
              </div>
            </div>
          )}

          {isPro && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Your subscription is active and will renew automatically.</p>
              <Button variant="outline" size="sm">
                Manage Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
