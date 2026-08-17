import { useEffect, useState } from "react";
import type { AuthStatus } from "../types/amp";

export function useAuthStatus() {
    const [authStatus, setAuthStatus] = useState<AuthStatus>({
        credentials: false,
        token: false,
    });

    const refreshAuthStatus = async () => {
        const result = await window.electronAPI.getGCPAuthStatus();
        setAuthStatus(result);
    };

    const importCredentials = async () => {
        await window.electronAPI.importCredentials();
        await refreshAuthStatus();
    };

    useEffect(() => {
        refreshAuthStatus();
    }, []);

    return {
        authStatus,
        refreshAuthStatus,
        importCredentials,
    };
}