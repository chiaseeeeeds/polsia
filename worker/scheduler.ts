import * as cron from "node-cron";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runCycle } from "./orchestrator";

const activeTasks = new Map<string, cron.ScheduledTask>();

export async function startScheduler() {
  console.log("[Scheduler] Starting scheduler...");

  // Load all active companies and schedule their cycles
  const activeCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.status, "active"));

  for (const company of activeCompanies) {
    scheduleCompany(company.id, company.cycleSchedule ?? "0 6 * * *");
  }

  // Also run a check every 5 minutes for new/updated companies
  cron.schedule("*/5 * * * *", async () => {
    await refreshSchedules();
  });

  console.log(`[Scheduler] Scheduled ${activeCompanies.length} companies`);
}

export function scheduleCompany(companyId: string, cronExpression: string) {
  // Cancel existing schedule if any
  const existing = activeTasks.get(companyId);
  if (existing) {
    existing.stop();
  }

  if (!cron.validate(cronExpression)) {
    console.warn(`[Scheduler] Invalid cron expression for ${companyId}: ${cronExpression}`);
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Starting cycle for company ${companyId}`);
    try {
      await runCycle(companyId);
      console.log(`[Scheduler] Cycle completed for company ${companyId}`);
    } catch (err) {
      console.error(`[Scheduler] Cycle failed for company ${companyId}:`, err);
    }
  });

  activeTasks.set(companyId, task);
  console.log(`[Scheduler] Scheduled company ${companyId} with cron: ${cronExpression}`);
}

export function unscheduleCompany(companyId: string) {
  const task = activeTasks.get(companyId);
  if (task) {
    task.stop();
    activeTasks.delete(companyId);
    console.log(`[Scheduler] Unscheduled company ${companyId}`);
  }
}

async function refreshSchedules() {
  const activeCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.status, "active"));

  const activeIds = new Set(activeCompanies.map((c) => c.id));

  // Remove schedules for companies that are no longer active
  for (const [id] of activeTasks) {
    if (!activeIds.has(id)) {
      unscheduleCompany(id);
    }
  }

  // Add schedules for new companies
  for (const company of activeCompanies) {
    if (!activeTasks.has(company.id)) {
      scheduleCompany(company.id, company.cycleSchedule ?? "0 6 * * *");
    }
  }
}

export function stopScheduler() {
  for (const [id, task] of activeTasks) {
    task.stop();
  }
  activeTasks.clear();
  console.log("[Scheduler] Stopped all schedules");
}
