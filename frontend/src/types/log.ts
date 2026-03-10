export type ApiLogStatus = "success" | "error";

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  label?: string;
  method: string;
  endpoint: string;
  status: ApiLogStatus;
  request?: any;
  response?: any;
  error?: any;
}