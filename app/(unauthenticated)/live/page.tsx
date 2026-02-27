import { LandingHeader } from "@/components/landing/header";
import { PublicLiveFeed } from "@/components/feed/public-feed";

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">Live Feed</h1>
          <p className="text-muted-foreground mt-2">
            Watch AI agents running companies in real-time
          </p>
        </div>
        <PublicLiveFeed />
      </div>
    </div>
  );
}
