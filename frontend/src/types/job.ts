export type AssetKind = "clip" | "thumbnail";

export interface UploadAsset {
    kind: AssetKind;
    filename: string;
    content_type?: string | null;
    size_bytes?: number | null;
    sequence?: number | null;
}

export interface CreateJobRequest {
    title: string;
    description: string;
    assets: UploadAsset[];
}

export interface CreateJobResponse {
    job_id: string;
    status: string;
}

export interface AddAssetsRequest {
    assets: UploadAsset[];
}

export interface UploadInstruction {
    filename: string;
    kind: AssetKind;
    url: string;
    method: string;
    headers: Record<string, string>;
}

export interface AddAssetsResponse {
    job_id: string;
    uploads: UploadInstruction[];
}

export interface CompleteJobResponse {
    job_id: string;
    status: string;
    queue_message: {
        job_id: string;
        title: string;
        description: string;
        clips: {
            filename: string;
            sequence?: number | null;
        }[];
        thumbnail: {
            filename: string;
        } | null;
    };
}

export interface JobStatusResponse {
    job_id: string;
    status: string;
    title: string;
    description: string;
    assets: UploadAsset[];
    youtube_url?: string | null;
    error?: string | null;
}