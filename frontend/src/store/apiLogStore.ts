import type { ApiLogEntry } from "@/types/log";

type Listener = (logs: ApiLogEntry[]) => void;

let logs: ApiLogEntry[] = [];
const listeners = new Set<Listener>();

export function getApiLogs() {
  return logs;
}

export function subscribeApiLogs(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearApiLogs() {
  logs = [];
  listeners.forEach((listener) => listener(logs));
}

export function pushApiLog(entry: Omit<ApiLogEntry, "id" | "timestamp">) {
  const nextEntry: ApiLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toLocaleTimeString(),
    ...entry,
  };

  logs = [nextEntry, ...logs];
  listeners.forEach((listener) => listener(logs));
}