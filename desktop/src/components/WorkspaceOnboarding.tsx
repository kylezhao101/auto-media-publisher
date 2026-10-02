import { Building2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OrganizationState } from "@/hooks/useOrganization";
import type { OnboardingStep } from "@/helpers/onboarding";

type Props = {
  step: OnboardingStep;
  organization: OrganizationState;
  onPersonal: () => void;
  onChoose: (step: OnboardingStep) => void;
  onSelectOrganization: (id: string) => void;
  onCreate: () => void;
  onDismiss: () => void;
};

export function WorkspaceOnboarding({
  step,
  organization,
  onPersonal,
  onChoose,
  onSelectOrganization,
  onCreate,
  onDismiss,
}: Props) {
  if (step === "welcome") {
    return (
      <section
        className="mx-auto w-full max-w-3xl py-12 space-y-6"
        aria-labelledby="welcome-title"
      >
        <div className="space-y-2">
          <h2 id="welcome-title" className="text-2xl font-semibold">
            Welcome to Auto Media Publisher
          </h2>
          <p className="text-muted-foreground">
            Turn local recordings into YouTube videos. How would you like to get
            started?
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <UserRound aria-hidden="true" className="size-5" />
              <CardTitle>Publish on my own</CardTitle>
              <CardDescription>
                Use your own YouTube channel. We'll guide you through setting up
                Google credentials on this device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onPersonal}>Set up Personal</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Users aria-hidden="true" className="size-5" />
              <CardTitle>Join my team</CardTitle>
              <CardDescription>
                Sign in to use your team's workspace and shared YouTube
                connection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => onChoose("join")}>
                Join a team
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Building2 aria-hidden="true" className="size-5" />
              <CardTitle>Set up a team</CardTitle>
              <CardDescription>
                Create a workspace, connect a channel, and invite your
                publishing team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => onChoose("create")}>
                Set up a team
              </Button>
            </CardContent>
          </Card>
        </div>
        <Button variant="ghost" onClick={onDismiss}>
          Skip for now
        </Button>
      </section>
    );
  }

  const signedIn = Boolean(organization.session);
  const loading =
    organization.loading ||
    organization.loadingOrganizations ||
    (signedIn &&
      organization.organizationsUserId !== organization.user?.id &&
      !organization.organizationError);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === "join"
            ? "Join your team's workspace"
            : "Set up your team workspace"}
        </CardTitle>
        <CardDescription>
          {!signedIn
            ? "Sign in below to continue. Your team's YouTube connection is managed in the organization workspace."
            : step === "create"
              ? "Create an organization, then connect its YouTube channel from the Organization page."
              : "Choose your organization to continue with its shared publishing settings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading your workspaces…
          </p>
        )}
        {signedIn && !loading && organization.organizationError && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">
              {organization.organizationError}
            </p>
            <Button
              variant="outline"
              onClick={() => void organization.refreshOrganizations()}
            >
              Retry loading workspaces
            </Button>
          </div>
        )}
        {signedIn &&
          !loading &&
          !organization.organizationError &&
          step === "join" && (
            <>
              {organization.organizations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {organization.organizations.map((org) => (
                    <Button
                      key={org.id}
                      variant="outline"
                      onClick={() => onSelectOrganization(org.id)}
                    >
                      {org.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm">
                  No organizations yet. Ask your team admin to invite{" "}
                  <strong>
                    {organization.user?.email ?? "your sign-in email"}
                  </strong>
                  , then accept the link in the invitation email and refresh
                  this list.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => void organization.refreshOrganizations()}
              >
                Refresh workspaces
              </Button>
            </>
          )}
        {signedIn && !loading && step === "create" && (
          <Button onClick={onCreate}>Create organization</Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onChoose("welcome")}>
            Back to choices
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Continue later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
