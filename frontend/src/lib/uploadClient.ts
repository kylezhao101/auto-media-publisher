import axios, { AxiosError } from "axios"
import { pushApiLog } from "@/lib/apiLogStore"

export const uploadClient = axios.create()

uploadClient.interceptors.response.use(
  (response) => {
    pushApiLog({
      label: "Blob Upload",
      method: (response.config.method || "PUT").toUpperCase(),
      endpoint: response.config.url || "",
      status: "success",
      request: {
        headers: response.config.headers,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
      },
    })

    return response
  },
  (error: AxiosError) => {
    pushApiLog({
      label: "Blob Upload",
      method: (error.config?.method || "PUT").toUpperCase(),
      endpoint: error.config?.url || "",
      status: "error",
      request: {
        headers: error.config?.headers,
      },
      response: error.response?.data,
      error: error.message,
    })

    return Promise.reject(error)
  }
)