import "dotenv/config";
import { startScheduler, stopScheduler } from "./scheduler";

async function main() {
  console.log("=================================");
  console.log("  Polsia Worker Process");
  console.log("  Starting up...");
  console.log("=================================");

  await startScheduler();

  console.log("[Worker] Ready and running");

  // Handle graceful shutdown
  const shutdown = () => {
    console.log("\n[Worker] Shutting down...");
    stopScheduler();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
