import type { AgentLogEntry, SSEEvent } from "@/types";

// Global set of active SSE connections keyed by companyId
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Public feed connections (no company filter)
const publicConnections = new Set<ReadableStreamDefaultController>();

export function addConnection(companyId: string, controller: ReadableStreamDefaultController) {
  if (!connections.has(companyId)) {
    connections.set(companyId, new Set());
  }
  connections.get(companyId)!.add(controller);
}

export function removeConnection(companyId: string, controller: ReadableStreamDefaultController) {
  connections.get(companyId)?.delete(controller);
  if (connections.get(companyId)?.size === 0) {
    connections.delete(companyId);
  }
}

export function addPublicConnection(controller: ReadableStreamDefaultController) {
  publicConnections.add(controller);
}

export function removePublicConnection(controller: ReadableStreamDefaultController) {
  publicConnections.delete(controller);
}

export function broadcast(companyId: string, event: SSEEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);

  // Send to company-specific listeners
  const companyConns = connections.get(companyId);
  if (companyConns) {
    for (const controller of companyConns) {
      try {
        controller.enqueue(encoded);
      } catch {
        companyConns.delete(controller);
      }
    }
  }

  // Send to public feed (anonymized)
  for (const controller of publicConnections) {
    try {
      controller.enqueue(encoded);
    } catch {
      publicConnections.delete(controller);
    }
  }
}

export function broadcastLog(log: AgentLogEntry) {
  broadcast(log.companyId, { type: "log", data: log });
}
