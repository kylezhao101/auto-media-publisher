import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuthStatus } from "@/types/amp";
import type { YouTubeConnectionState } from "@/hooks/useYoutubeConnection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authStatus: AuthStatus;
  youtube: YouTubeConnectionState;
  importCredentials: () => Promise<boolean>;
  refreshAuthStatus: () => Promise<void>;
};

export function YouTubeSetupDialog({
  open,
  onOpenChange,
  authStatus,
  youtube,
  importCredentials,
  refreshAuthStatus,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<{
    channel_name: string;
    channel_handle?: string;
  } | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Setup failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setMessage("Finish Google sign-in in your browser, then return here.");
    const result = await window.electronAPI.connectToYouTube();
    if (!result.success)
      throw new Error("Sign-in did not complete. Try connecting again.");
    await refreshAuthStatus();
    await confirmChannel();
  }

  async function confirmChannel() {
    setMessage("Checking your YouTube channel…");
    setChannel(await window.electronAPI.getYouTubeChannel());
    await youtube.refresh();
    setMessage("YouTube is ready. Check the channel below before publishing.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Set up YouTube</DialogTitle>
          <DialogDescription>
            Connect a channel for your Personal workspace. AMP uses your own
            Google OAuth credentials; your credentials and sign-in tokens stay
            on this device.
          </DialogDescription>
        </DialogHeader>
        <section className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">
            1. Create and import credentials {authStatus.credentials && "✓"}
          </h3>
          <p className="text-muted-foreground">
            Already have a Desktop app credentials JSON? Import it below.
            Otherwise, complete these steps in Google Cloud:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Create or select a project and enable{" "}
              <strong>YouTube Data API v3</strong>.
            </li>
            <li>
              Configure the app in <strong>Google Auth platform</strong>. Set
              its name and contact information. For an External app in Testing,
              add your Google account under{" "}
              <strong>Audience → Test users</strong>.
            </li>
            <li>
              Under <strong>Clients</strong>, create an OAuth client with
              application type <strong>Desktop app</strong>, then download its
              JSON file.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.electronAPI.openExternal(
                    "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                  );
                })
              }
            >
              Open Google Cloud
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.electronAPI.openExternal(
                    "https://developers.google.com/youtube/v3/guides/auth/installed-apps"
                  );
                })
              }
            >
              Google setup guide
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (await importCredentials()) {
                    setChannel(null);
                    setMessage(
                      "Credentials imported and validated. Continue to Google sign-in."
                    );
                  } else
                    setMessage(
                      "No file selected. Choose your downloaded credentials JSON to continue."
                    );
                })
              }
            >
              {authStatus.credentials
                ? "Replace credentials JSON"
                : "Import credentials JSON"}
            </Button>
          </div>
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">
            2. Sign in with Google {authStatus.token && "✓"}
          </h3>
          <p className="text-muted-foreground">
            Choose the Google account and YouTube channel you want to publish
            to, and grant the requested YouTube permissions.
          </p>
          <Button
            disabled={busy || !authStatus.credentials}
            onClick={() => void run(connect)}
          >
            {busy
              ? "Please wait…"
              : authStatus.token
                ? "Sign in again"
                : "Connect YouTube"}
          </Button>
          {!authStatus.credentials && (
            <p className="text-muted-foreground">
              Import credentials in step 1 to enable sign-in.
            </p>
          )}
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">3. Confirm your channel</h3>
          {channel || youtube.connection.connected ? (
            <p>
              Publishing to{" "}
              <strong>
                {channel?.channel_name ??
                  youtube.connection.channelName ??
                  "your connected channel"}
              </strong>{" "}
              {channel?.channel_handle ?? youtube.connection.channelHandle}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Your channel will appear here after sign-in.
            </p>
          )}
          {authStatus.token && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(confirmChannel)}
            >
              Check channel
            </Button>
          )}
        </section>
        <div aria-live="polite" role="status">
          {message}
        </div>
        {error && (
          <div role="alert" className="space-y-2 text-destructive">
            <p>{error}</p>
            <p>
              If Google blocks sign-in, check that the API is enabled, your
              account is a test user, and the downloaded client is a Desktop
              app. If the channel check fails, retry it or sign in with an
              account that has a YouTube channel.
            </p>
          </div>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          {channel || youtube.connection.connected ? "Done" : "Continue later"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
