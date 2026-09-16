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

export async function apiPost(
    path: string,
    accessToken: string,
    body: unknown,
) {
    const response = await apiFetch(path, accessToken, {
        method: "POST",
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }

    return response;
}