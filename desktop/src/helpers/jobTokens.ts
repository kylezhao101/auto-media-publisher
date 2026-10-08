import { supabase } from "./supabase";
import { createOrganizationYouTubeUploadSession } from "../api/youtube";
import type { YouTubeAuth } from "../vite-env";

// Capture the job's workspace and account, rather than the current UI selection.
export function listenForJobTokens(
  jobId: string,
  auth: YouTubeAuth
): () => void {
  let active = true;
  const controllers = new Set<AbortController>();
  const unsubscribe = window.electronAPI.onYouTubeTokenRequest(
    async (request) => {
      if (!active || request.jobId !== jobId || auth.type !== "organization")
        return;
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== auth.user_id) {
          throw new Error(
            "Sign in with the account that started this job, then retry the saved render."
          );
        }
        const token = await createOrganizationYouTubeUploadSession(
          auth.organization_id,
          data.session.access_token,
          controller.signal
        );
        const current = await supabase.auth.getSession();
        if (current.error || current.data.session?.user.id !== auth.user_id) {
          throw new Error(
            "The signed-in account changed. Sign in again and retry the saved render."
          );
        }
        if (active && !controller.signal.aborted) {
          await window.electronAPI.respondYouTubeToken({
            ...request,
            access_token: token.access_token,
            expires_at: token.expires_at,
          });
        }
      } catch (error) {
        if (active) {
          await window.electronAPI
            .respondYouTubeToken({
              ...request,
              error: controller.signal.aborted
                ? "Authorization timed out. Check your connection and retry."
                : error instanceof Error
                  ? error.message
                  : "Could not authorize YouTube.",
            })
            .catch(() => {});
        }
      } finally {
        clearTimeout(timer);
        controllers.delete(controller);
      }
    }
  );
  return () => {
    active = false;
    unsubscribe();
    controllers.forEach((controller) => controller.abort());
  };
}
