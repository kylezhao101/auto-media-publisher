const API_URL = import.meta.env.VITE_API_URL

export async function apiFetch(
    path: string,
    accessToken: string,
    options: RequestInit = {},
) {
    return fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...options.headers,
        },
    })
}