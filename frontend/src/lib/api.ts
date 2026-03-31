import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

import { pushApiLog } from "@/store/apiLogStore";
import type {
  AddAssetsRequest,
  AddAssetsResponse,
  SubmitJobResponse,
  CreateJobRequest,
  CreateJobResponse,
  JobStatusResponse,
} from "@/types/job";

import { getApiKey } from "@/store/apiKeyStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type RequestMeta = {
  label?: string;
};

declare module "axios" {
  export interface AxiosRequestConfig {
    meta?: RequestMeta;
  }
  export interface InternalAxiosRequestConfig {
    meta?: RequestMeta;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => {
    pushApiLog({
      label: response.config.meta?.label,
      method: (response.config.method || "GET").toUpperCase(),
      endpoint: response.config.url || "",
      status: "success",
      request: response.config.data,
      response: response.data,
    });

    return response;
  },
  (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    pushApiLog({
      label: config?.meta?.label,
      method: (config?.method || "GET").toUpperCase(),
      endpoint: config?.url || "",
      status: "error",
      request: config?.data,
      response: error.response?.data,
      error: error.message,
    });

    return Promise.reject(error);
  }
);

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const key = getApiKey();
  if (key) {
    config.headers["X-API-Key"] = key;
  }
  return config;
});


export async function createJob(
  payload: CreateJobRequest
): Promise<CreateJobResponse> {
  const res = await api.post<CreateJobResponse>("/jobs", payload, {
    meta: { label: "Create Job" },
  });
  return res.data;
}

export async function addAssets(
  jobId: string,
  payload: AddAssetsRequest
): Promise<AddAssetsResponse> {
  const res = await api.post<AddAssetsResponse>(`/jobs/${jobId}/assets`, payload, {
    meta: { label: "Add Assets" },
  });
  return res.data;
}

export async function submitJob(jobId: string): Promise<SubmitJobResponse> {
  const res = await api.post<SubmitJobResponse>(`/jobs/${jobId}/submit`, undefined, {
    meta: { label: "Submit Job" },
  });
  return res.data;
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await api.get<JobStatusResponse>(`/jobs/${jobId}`, {
    meta: { label: "Get Job Status" },
  });
  return res.data;
}
