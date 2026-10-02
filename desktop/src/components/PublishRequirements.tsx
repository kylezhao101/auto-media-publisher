import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PublishRequirement = {
  id: string;
  complete: boolean;
  label: string;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
};

export function PublishRequirements({
  requirements,
  disabled,
}: {
  requirements: PublishRequirement[];
  disabled: boolean;
}) {
  const remaining = requirements.filter(
    (requirement) => !requirement.complete
  ).length;

  return (
    <section
      aria-labelledby="publish-requirements-title"
      className="rounded-lg border p-4 space-y-3"
    >
      <h3
        id="publish-requirements-title"
        className="text-sm font-medium"
        role="status"
        aria-live="polite"
      >
        {remaining === 0
          ? "Ready to start"
          : `${remaining} ${remaining === 1 ? "requirement" : "requirements"} remaining`}
      </h3>
      <ul className="space-y-3">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            {requirement.complete ? (
              <Check aria-hidden="true" className="size-4 text-green-600" />
            ) : (
              <Circle
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            )}
            <div className="min-w-0 flex-1">
              <p>
                <span className="sr-only">
                  {requirement.complete ? "Complete: " : "Required: "}
                </span>
                {requirement.label}
              </p>
              {requirement.detail && (
                <p className="text-xs text-muted-foreground">
                  {requirement.detail}
                </p>
              )}
            </div>
            {!requirement.complete && (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={requirement.onAction}
              >
                {requirement.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
