import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { LandingHeader } from "@/components/landing/header";

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <div className="container mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold text-center mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          One plan, everything included. No hidden fees.
        </p>

        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "1 AI company",
                  "4 agent roles",
                  "5 cycles per month",
                  "Basic live feed",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button variant="outline" className="w-full mt-6">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Pro</CardTitle>
                <Badge>Popular</Badge>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Unlimited AI companies",
                  "4 agent roles per company",
                  "Unlimited daily cycles",
                  "Full MCP tool ecosystem",
                  "Real-time live feed",
                  "Metrics & analytics",
                  "6 pre-built templates",
                  "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button className="w-full mt-6">Start Pro Trial</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
