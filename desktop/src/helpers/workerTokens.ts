import type { YouTubeTokenResponse } from "../vite-env.js";

export class WorkerTokens {
  readonly jobId: string;
  readonly ownerId: number;
  private write: (message: object) => void;
  private notify: (request: { jobId: string; requestId: string }) => void;
  private timeout: number;
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  private active = true;

  constructor(
    jobId: string,
    ownerId: number,
    write: (message: object) => void,
    notify: (request: { jobId: string; requestId: string }) => void,
    timeout = 30000
  ) {
    this.jobId = jobId;
    this.ownerId = ownerId;
    this.write = write;
    this.notify = notify;
    this.timeout = timeout;
  }

  request(requestId: string) {
    if (!this.active || this.pending.has(requestId)) return;
    const timer = setTimeout(() => {
      this.respond(this.ownerId, {
        jobId: this.jobId,
        requestId,
        error: "YouTube authorization timed out. Retry the saved render.",
      });
    }, this.timeout);
    this.pending.set(requestId, timer);
    this.notify({ jobId: this.jobId, requestId });
  }

  respond(ownerId: number, response: YouTubeTokenResponse) {
    if (
      !this.active ||
      ownerId !== this.ownerId ||
      response.jobId !== this.jobId
    )
      return;
    const timer = this.pending.get(response.requestId);
    if (!timer) return;
    clearTimeout(timer);
    this.pending.delete(response.requestId);
    this.write({
      type: "token-response",
      request_id: response.requestId,
      access_token: response.access_token,
      expires_at: response.expires_at,
      error: response.error,
    });
  }

  close() {
    this.active = false;
    this.pending.forEach(clearTimeout);
    this.pending.clear();
  }
}
