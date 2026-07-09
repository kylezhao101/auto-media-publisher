import { useEffect, useState } from "react";
import type { RenderedVideo } from "../types/amp";

export function useRenders() {
    const [renders, setRenders] = useState<RenderedVideo[]>([]);

    const loadRenders = async () => {
        const existing = await window.electronAPI.listRenders();
        setRenders(existing);
    };

    useEffect(() => {
        loadRenders();
    }, []);

    return {
        renders,
        loadRenders,
    };
}