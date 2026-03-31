const KEY = "api_key";

export function getApiKey(): string {
  return sessionStorage.getItem(KEY) || "";
}

export function setApiKey(key: string): void {
  sessionStorage.setItem(KEY, key);
}

export function clearApiKey(): void {
  sessionStorage.removeItem(KEY);
}

export function hasApiKey(): boolean {
  return !!sessionStorage.getItem(KEY);
}