"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentLogEntry, SSEEvent } from "@/types";

export function useSSE(companyId: string | null) {
  const [events, setEvents] = useState<AgentLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!companyId) return;

    const url = `/api/agent/feed?companyId=${companyId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (data.type === "log") {
          setEvents((prev) => [data.data as AgentLogEntry, ...prev].slice(0, 200));
        }
      } catch {
        // Ignore parse errors (heartbeats)
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  }, [companyId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}

export function usePublicSSE() {
  const [events, setEvents] = useState<AgentLogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/agent/feed/public");

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (data.type === "log") {
          setEvents((prev) => [data.data as AgentLogEntry, ...prev].slice(0, 100));
        }
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => es.close();
  }, []);

  return { events, connected };
}
