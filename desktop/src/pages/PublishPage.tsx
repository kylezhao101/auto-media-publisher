import { useEffect, useState } from "react";
import { YouTubeSetupDialog } from "@/components/YouTubeSetupDialog";
import {
  PublishRequirements,
  type PublishRequirement,
} from "@/components/PublishRequirements";

import type {
  Encoder,
  EncoderCapabilities,
  PerformanceMode,
  Visibility,
} from "./../vite-env";
import type { RenderedVideo, Thumbnail, YouTubeAuth } from "./../types/amp";
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "./../constants/defaults";
import { useRenders } from "./../hooks/useRenders";
import { useJobRunner } from "./../hooks/useJobRunner";
import { usePlaylists } from "./../hooks/usePlaylists";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Check,
  ChevronsUpDown,
  ChevronDown,
  RefreshCw,
  FolderOpen,
  Cpu,
  Gauge,
  Eye,
  ListVideo,
  ExternalLink,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { GripVertical, X } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { OrganizationState } from "../hooks/useOrganization";

import type { AuthStatus } from "@/types/amp";
import type { YouTubeConnectionState } from "@/hooks/useYoutubeConnection";
import { getOrganizationYouTubePlaylists } from "@/api/youtube";

type PublishPageProps = {
  workspace: string;
  organization: OrganizationState;
  authStatus: AuthStatus;
  youtube: YouTubeConnectionState;
  importCredentials: () => Promise<boolean>;
  refreshAuthStatus: () => Promise<void>;
  onOpenOrganization: () => void;
  setupOpen: boolean;
  onSetupOpenChange: (open: boolean) => void;
};

type PersonalDraft = {
  title: string;
  description: string;
  visibility: Visibility;
};

export function PublishPage({
  workspace,
  organization,
  authStatus,
  youtube,
  importCredentials,
  refreshAuthStatus,
  onOpenOrganization,
  setupOpen,
  onSetupOpenChange: setSetupOpen,
}: PublishPageProps) {
  const isLocal = workspace === "local";
  const [browserError, setBrowserError] = useState("");

  const currentMembership = organization.members.find(
    (member) => member.user_id === organization.user?.id
  );

  const canPublishOrganization =
    currentMembership?.role === "owner" ||
    currentMembership?.role === "admin" ||
    currentMembership?.role === "publisher";

  const [videos, setVideos] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);

  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    visibility: "private",
  });

  const [encoder, setEncoder] = useState<Encoder>("auto");
  const [encoderCapabilities, setEncoderCapabilities] =
    useState<EncoderCapabilities | null>(null);
  const [encoderError, setEncoderError] = useState("");
  const [checkingEncoders, setCheckingEncoders] = useState(true);
  const [encoderCheckAttempt, setEncoderCheckAttempt] = useState(0);
  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("balanced");
  const [visibilityStatus, setVisibilityStatus] =
    useState<Visibility>("private");

  useEffect(() => {
    let active = true;
    setCheckingEncoders(true);
    setEncoderCapabilities(null);
    setEncoderError("");
    window.electronAPI
      .getEncoders(performanceMode)
      .then((result) => {
        if (!active) return;
        setEncoderCapabilities(result);
        setEncoder((current) =>
          current === "auto" ||
          result.encoders.some((item) => item.id === current && item.available)
            ? current
            : "auto"
        );
      })
      .catch((error: unknown) => {
        if (active)
          setEncoderError(
            error instanceof Error ? error.message : "Encoder detection failed."
          );
      })
      .finally(() => {
        if (active) setCheckingEncoders(false);
      });
    return () => {
      active = false;
    };
  }, [performanceMode, encoderCheckAttempt]);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const { renders, loadRenders } = useRenders();
  const {
    progress,
    setProgress,
    isRunning,
    startJob,
    uploadExisting,
    cancelJob,
  } = useJobRunner();

  const { connection: youtubeConnection, refresh: refreshYouTubeConnection } =
    youtube;

  const playlistsEnabled = isLocal
    ? Boolean(authStatus.token)
    : Boolean(
        organization.session &&
        youtubeConnection.connected &&
        canPublishOrganization
      );

  async function fetchWorkspacePlaylists() {
    if (isLocal) {
      return window.electronAPI.listPlaylists();
    }

    if (!organization.session) {
      return [];
    }

    return getOrganizationYouTubePlaylists(
      workspace,
      organization.session.access_token
    );
  }

  const {
    playlistOptions,
    selectedPlaylistIds,
    setSelectedPlaylistIds,
    isLoadingPlaylists,
    playlistError,
    loadPlaylists,
  } = usePlaylists({
    enabled: playlistsEnabled,
    sourceKey: JSON.stringify([
      workspace,
      isLocal ? null : organization.user?.id,
      youtubeConnection.channelId,
    ]),

    fetchPlaylists: fetchWorkspacePlaylists,
  });

  async function handleRefreshConnection() {
    if (isLocal) {
      await refreshAuthStatus();
    }

    await refreshYouTubeConnection();
  }

  async function getYouTubeAuth(): Promise<YouTubeAuth> {
    if (isLocal) {
      return {
        type: "local",
      };
    }

    if (!organization.session) {
      throw new Error("You must be signed in to publish for an organization.");
    }

    if (!canPublishOrganization) {
      throw new Error(
        "You do not have permission to publish for this organization."
      );
    }

    if (!youtubeConnection.connected) {
      throw new Error("YouTube is not connected for this organization.");
    }

    return {
      type: "organization",
      organization_id: workspace,
      user_id: organization.session.user.id,
    };
  }

  useEffect(() => {
    setSelectedPresetId("");
    setSelectedPlaylistIds([]);

    if (workspace === "local") {
      setTitle(personalDraft.title);
      setDescription(personalDraft.description);
      setVisibilityStatus(personalDraft.visibility);

      void refreshYouTubeConnection();

      return;
    }

    setTitle("");
    setDescription("");
    setVisibilityStatus("private");

    if (!organization.session) {
      return;
    }

    void Promise.all([
      organization.loadMembers(workspace),
      organization.loadPresets(workspace),
      refreshYouTubeConnection(),
    ]);
  }, [workspace, organization.session?.user.id]);

  function applyPreset(presetId: string | null) {
    if (!presetId) {
      setSelectedPresetId("");
      return;
    }

    setSelectedPresetId(presetId);

    const preset = organization.presets.find(
      (preset) => preset.id === presetId
    );

    if (!preset) {
      return;
    }

    setTitle(preset.title_template ?? "");

    setDescription(preset.description_template ?? "");

    setVisibilityStatus(preset.visibility);
  }

  const selectedPreset = organization.presets.find(
    (preset) => preset.id === selectedPresetId
  );

  const handleSelectVideos = async () => {
    const selected = await window.electronAPI.selectVideos();

    setVideos((current) => {
      const existing = new Set(current);

      const newVideos = selected.filter((video) => !existing.has(video));

      return [...current, ...newVideos];
    });
  };

  const handleSelectThumbnail = async () => {
    const selected = await window.electronAPI.selectThumbnail();
    setThumbnail(selected);
  };

  const handleStartJob = async () => {
    try {
      const youtubeAuth = await getYouTubeAuth();

      await startJob({
        organizationId: isLocal ? null : workspace,
        videos,
        thumbnail,
        title,
        description,
        encoder,
        performanceMode,
        visibilityStatus,
        selectedPlaylistIds,
        youtubeAuth,
        loadRenders,
      });
    } catch (error) {
      setProgress({
        stage: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Failed to prepare YouTube upload",
      });
    }
  };

  const handleUploadExisting = async (render: RenderedVideo) => {
    try {
      const youtubeAuth = await getYouTubeAuth();

      await uploadExisting({
        organizationId: isLocal ? null : workspace,
        render,
        thumbnail,
        title,
        description,
        encoder,
        performanceMode,
        visibilityStatus,
        selectedPlaylistIds,
        youtubeAuth,
      });
    } catch (error) {
      setProgress({
        stage: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Failed to prepare YouTube upload",
      });
    }
  };

  const handleCancelJob = () => cancelJob(loadRenders);

  const progressLabel = () => {
    if (!progress) return "";
    if (progress.stage === "rendering") {
      return `Rendering… ${progress.percent ?? 0}%`;
    }
    if (progress.stage === "uploading") {
      return `Uploading… ${progress.percent ?? 0}%`;
    }
    if (progress.stage === "done") {
      return progress.video_id
        ? `Done. Video ID: ${progress.video_id}`
        : `${progress.message ?? "Done"}`;
    }
    if (progress.stage === "warning") return `${progress.message}`;
    return "";
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setVideos((videos) => {
      const oldIndex = videos.indexOf(String(active.id));
      const newIndex = videos.indexOf(String(over.id));

      return arrayMove(videos, oldIndex, newIndex);
    });
  }

  function removeVideo(video: string) {
    setVideos((videos) => videos.filter((item) => item !== video));
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (isLocal) {
      setPersonalDraft((current) => ({
        ...current,
        title: value,
      }));
    }
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);

    if (isLocal) {
      setPersonalDraft((current) => ({
        ...current,
        description: value,
      }));
    }
  }

  function handleVisibilityChange(value: Visibility) {
    setVisibilityStatus(value);

    if (isLocal) {
      setPersonalDraft((current) => ({
        ...current,
        visibility: value,
      }));
    }
  }

  const youtubeConnected = isLocal
    ? Boolean(authStatus.token)
    : youtubeConnection.connected;

  const canPublish = isLocal
    ? Boolean(authStatus.token)
    : Boolean(canPublishOrganization && youtubeConnected);

  const encoderReady =
    encoder === "auto"
      ? !checkingEncoders && Boolean(encoderCapabilities?.preferred)
      : encoderCapabilities
        ? !checkingEncoders &&
          encoderCapabilities.encoders.some(
            (item) => item.id === encoder && item.available
          )
        : encoder === "cpu";
  const canStart =
    Boolean(thumbnail) && videos.length > 0 && canPublish && encoderReady;

  const requirements: PublishRequirement[] = [
    {
      id: "clips",
      complete: videos.length > 0,
      label:
        videos.length > 0
          ? `${videos.length} ${videos.length === 1 ? "clip" : "clips"} selected`
          : "Add at least one video clip",
      actionLabel: "Add clips",
      onAction: () => {
        void handleSelectVideos();
      },
    },
    {
      id: "thumbnail",
      complete: Boolean(thumbnail),
      label: thumbnail ? "Thumbnail selected" : "Choose a thumbnail",
      actionLabel: "Choose thumbnail",
      onAction: () => {
        void handleSelectThumbnail();
      },
    },
    {
      id: "youtube",
      complete: youtubeConnected,
      label: youtubeConnected
        ? `YouTube connected${youtubeConnection.channelName ? `: ${youtubeConnection.channelName}` : ""}`
        : "Connect a YouTube channel",
      detail:
        !isLocal && !youtubeConnected
          ? "An organization owner or admin can connect a channel from the Organization page."
          : undefined,
      actionLabel: isLocal ? "Set up YouTube" : "Open organization",
      onAction: isLocal ? () => setSetupOpen(true) : onOpenOrganization,
    },
  ];

  if (!isLocal) {
    requirements.push({
      id: "permission",
      complete: Boolean(organization.session && canPublishOrganization),
      label: !organization.session
        ? "Sign in to your organization"
        : organization.loadingMembers
          ? "Checking publishing permission…"
          : canPublishOrganization
            ? "Publishing permission confirmed"
            : "Publishing permission required",
      detail:
        organization.session &&
        !organization.loadingMembers &&
        !canPublishOrganization
          ? "Ask an owner or admin to give you the Publisher, Admin, or Owner role."
          : undefined,
      actionLabel: organization.session ? "View organization" : "Sign in",
      onAction: onOpenOrganization,
    });
  }

  const preferredEncoder = encoderCapabilities?.encoders.find(
    (item) => item.id === encoderCapabilities.preferred
  );
  const encoderLabel =
    encoder === "auto"
      ? checkingEncoders
        ? "Auto — checking encoders…"
        : `Auto — ${preferredEncoder?.label ?? "unavailable"}`
      : (encoderCapabilities?.encoders.find((item) => item.id === encoder)
          ?.label ?? "CPU / x264");

  const performanceLabel =
    performanceMode === "fast"
      ? "Fast"
      : performanceMode === "balanced"
        ? "Balanced"
        : "Low impact";

  const visibilityLabel =
    visibilityStatus === "private"
      ? "Private"
      : visibilityStatus === "unlisted"
        ? "Unlisted"
        : "Public";

  function SortableVideo({
    video,
    index,
    disabled,
    onRemove,
  }: {
    video: string;
    index: number;
    disabled: boolean;
    onRemove: () => void;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: video,
      disabled,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const filename = video.split(/[\\/]/).pop() ?? video;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
                flex items-center gap-2
                bg-background border-b border-border/60 
                last:border-b-0
                ${isDragging ? "z-10 shadow-md" : ""}
            `}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="
                    flex size-4 shrink-0 cursor-grab
                    items-center justify-center rounded
                    text-muted-foreground
                    hover:bg-muted hover:text-foreground
                    active:cursor-grabbing
                "
        >
          <GripVertical className="size-4" />
        </button>

        <span className="w-5 text-center text-xs text-muted-foreground">
          {index + 1}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm" title={video}>
          {filename}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Connection */}
      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <CardTitle>Connection</CardTitle>

              {isLocal ? (
                <>
                  <Badge
                    variant={authStatus.credentials ? "success" : "outline"}
                  >
                    {authStatus.credentials && (
                      <span className="size-1.5 rounded-full bg-green-500" />
                    )}
                    Credentials: {authStatus.credentials ? "Loaded" : "Missing"}
                  </Badge>

                  <Badge
                    variant={
                      youtubeConnection.connected ? "success" : "outline"
                    }
                  >
                    {youtubeConnection.connected && (
                      <span className="size-1.5 rounded-full bg-green-500" />
                    )}
                    YouTube:{" "}
                    {youtubeConnection.connected
                      ? (youtubeConnection.channelName ?? "Connected")
                      : "Not connected"}
                  </Badge>
                </>
              ) : (
                <>
                  <Badge
                    variant={
                      youtubeConnection.connected ? "success" : "outline"
                    }
                  >
                    {youtubeConnection.connected && (
                      <span className="size-1.5 rounded-full bg-green-500" />
                    )}
                    YouTube:{" "}
                    {youtubeConnection.connected
                      ? (youtubeConnection.channelName ?? "Connected")
                      : "Not connected"}
                  </Badge>

                  {currentMembership && (
                    <Badge variant="outline" className="capitalize">
                      Publishing as: {currentMembership.role}
                    </Badge>
                  )}
                </>
              )}
            </div>

            {!isLocal && youtubeConnection.channelHandle && (
              <p className="mt-2 text-sm text-muted-foreground">
                {youtubeConnection.channelHandle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isLocal && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setSetupOpen(true)}
                  disabled={isRunning}
                >
                  {youtubeConnection.connected
                    ? "YouTube setup"
                    : "Set up YouTube"}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              onClick={() => window.electronAPI.openLogsFolder()}
            >
              Logs
              <FolderOpen className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefreshConnection}
              disabled={isRunning}
              title="Refresh connection"
              aria-label="Refresh connection"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main publishing area */}
      {isLocal && (
        <YouTubeSetupDialog
          open={setupOpen}
          onOpenChange={setSetupOpen}
          authStatus={authStatus}
          youtube={youtube}
          importCredentials={importCredentials}
          refreshAuthStatus={refreshAuthStatus}
        />
      )}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle>Media</CardTitle>

            <CardDescription>
              Choose source clips and a thumbnail.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSelectVideos}
                disabled={isRunning}
              >
                {videos.length > 0 ? "Add clips" : "Select clips"}
              </Button>

              {videos.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setVideos([])}
                  disabled={isRunning}
                >
                  Clear all
                </Button>
              )}
            </div>

            {videos.length > 0 ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={videos}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {videos.map((video, index) => (
                      <SortableVideo
                        key={video}
                        video={video}
                        index={index}
                        disabled={isRunning}
                        onRemove={() => removeVideo(video)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No clips selected.
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleSelectThumbnail}
              disabled={isRunning}
            >
              Select thumbnail
            </Button>

            {thumbnail ? (
              <img
                src={thumbnail.preview}
                alt="Selected thumbnail"
                className="w-full rounded-lg object-cover aspect-video"
              />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No thumbnail selected.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishing details */}
        <Card>
          <CardHeader>
            <CardTitle>Publishing details</CardTitle>

            <CardDescription>
              Set video metadata and rendering options.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {!isLocal && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Preset</label>

                <UiSelect
                  value={selectedPresetId}
                  onValueChange={applyPreset}
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedPreset?.name ?? "Select preset..."}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    align="start"
                    sideOffset={4}
                  >
                    {organization.presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>

                {organization.presetsError && (
                  <p className="text-xs text-destructive">
                    {organization.presetsError}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="video-title" className="text-sm font-medium">
                Title
              </label>

              <Input
                id="video-title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={isRunning}
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="video-description"
                className="text-sm font-medium"
              >
                Description
              </label>

              <Textarea
                id="video-description"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isRunning}
                rows={12}
                className="text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 items-start">
              {/* Encoder */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Encoder</label>

                <UiSelect
                  value={encoder}
                  onValueChange={(value) => setEncoder(value as Encoder)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <Cpu className="size-4 text-muted-foreground" />

                        <span className="truncate">{encoderLabel}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="rounded-md border-border"
                  >
                    <SelectItem
                      value="auto"
                      disabled={checkingEncoders || !preferredEncoder}
                    >
                      Auto
                      {preferredEncoder ? ` — ${preferredEncoder.label}` : ""}
                    </SelectItem>
                    {(
                      encoderCapabilities?.encoders ?? [
                        {
                          id: "cpu",
                          label: "CPU / x264",
                          available: true,
                          reason: null,
                        },
                      ]
                    ).map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={!item.available}
                      >
                        <div>
                          <div>
                            {item.label}
                            {!item.available ? " — unavailable" : ""}
                          </div>
                          {item.reason && (
                            <div className="text-xs text-muted-foreground">
                              {item.reason}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
                <p className="text-xs text-muted-foreground" role="status">
                  {checkingEncoders
                    ? "Checking encoding support on this computer…"
                    : encoderError ||
                      (preferredEncoder
                        ? encoder === "auto" && preferredEncoder.id === "cpu"
                          ? "Auto uses CPU because no hardware encoder passed the test."
                          : "Available encoders passed a short test. If GPU rendering fails, select CPU and retry."
                        : "No working encoder found. Check your installation.")}
                </p>
                {encoderError && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRunning || checkingEncoders}
                    onClick={() => setEncoderCheckAttempt((value) => value + 1)}
                  >
                    Retry encoder check
                  </Button>
                )}
              </div>

              {/* Performance */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Performance</label>

                <UiSelect
                  value={performanceMode}
                  onValueChange={(value) =>
                    setPerformanceMode(value as PerformanceMode)
                  }
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <Gauge className="size-4 text-muted-foreground" />

                        <span>{performanceLabel}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="rounded-md border-border"
                  >
                    <SelectItem value="fast">Fast</SelectItem>

                    <SelectItem value="balanced">Balanced</SelectItem>

                    <SelectItem value="low">Low impact</SelectItem>
                  </SelectContent>
                </UiSelect>
              </div>

              {/* Visibility */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Visibility</label>

                <UiSelect
                  value={visibilityStatus}
                  onValueChange={(value) =>
                    handleVisibilityChange(value as Visibility)
                  }
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <Eye className="size-4 text-muted-foreground" />

                        <span>{visibilityLabel}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="rounded-md border-border"
                  >
                    <SelectItem value="private">Private</SelectItem>

                    <SelectItem value="unlisted">Unlisted</SelectItem>

                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </UiSelect>
              </div>

              {/* Playlists */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Playlists</label>

                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={isRunning || !playlistsEnabled}
                            className="h-10 w-full justify-between font-normal"
                          />
                        }
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <ListVideo className="size-4 shrink-0 text-muted-foreground" />

                          <span className="truncate">
                            {!playlistsEnabled
                              ? "Connect YouTube first"
                              : selectedPlaylistIds.length === 0
                                ? "Select playlists..."
                                : selectedPlaylistIds.length === 1
                                  ? (playlistOptions.find(
                                      (option) =>
                                        option.value === selectedPlaylistIds[0]
                                    )?.label ?? "1 playlist selected")
                                  : `${selectedPlaylistIds.length} playlists selected`}
                          </span>
                        </div>

                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder="Search playlists..." />

                          <CommandList>
                            <CommandEmpty>No playlists found.</CommandEmpty>

                            <CommandGroup>
                              {playlistOptions.map((option) => {
                                const selected = selectedPlaylistIds.includes(
                                  option.value
                                );

                                return (
                                  <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                      setSelectedPlaylistIds(
                                        selected
                                          ? selectedPlaylistIds.filter(
                                              (id) => id !== option.value
                                            )
                                          : [
                                              ...selectedPlaylistIds,
                                              option.value,
                                            ]
                                      );
                                    }}
                                  >
                                    <div
                                      className={`
                      mr-2 flex h-4 w-4 items-center justify-center
                      rounded-sm border border-primary
                      ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      }
                    `}
                                    >
                                      <Check className="h-3 w-3" />
                                    </div>

                                    <span>{option.label}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0"
                    title={
                      isLoadingPlaylists
                        ? "Refreshing playlists..."
                        : "Refresh playlists"
                    }
                    aria-label={
                      isLoadingPlaylists
                        ? "Refreshing playlists..."
                        : "Refresh playlists"
                    }
                    onClick={loadPlaylists}
                    disabled={
                      isRunning || isLoadingPlaylists || !playlistsEnabled
                    }
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={`size-4 ${isLoadingPlaylists ? "motion-safe:animate-spin" : ""}`}
                    />
                  </Button>
                </div>
                {playlistError && (
                  <p role="alert" className="text-sm text-destructive">
                    {playlistError}
                  </p>
                )}
              </div>
            </div>

            <PublishRequirements
              requirements={requirements}
              disabled={isRunning}
            />

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={handleStartJob}
                disabled={isRunning || !canStart}
              >
                {isRunning
                  ? progress?.stage === "uploading"
                    ? "Uploading to YouTube..."
                    : "Rendering & uploading..."
                  : "Render & upload to YouTube"}
              </Button>

              {isRunning && (
                <Button variant="destructive" onClick={handleCancelJob}>
                  Cancel job
                </Button>
              )}
              <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
                <div className="min-w-0">
                  <dt className="inline text-muted-foreground">Channel: </dt>
                  <dd className="inline font-medium break-words">
                    {!youtubeConnected
                      ? "Not connected"
                      : youtube.loading
                        ? "Loading channel..."
                        : (youtubeConnection.channelName ??
                          youtubeConnection.channelHandle ??
                          youtubeConnection.channelId ??
                          "Channel name unavailable")}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Visibility: </dt>
                  <dd className="inline font-medium">{visibilityLabel}</dd>
                </div>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">
              Clips are rendered on this device, then uploaded automatically.
              {visibilityStatus === "private"
                ? " Private videos are visible to you and people you choose."
                : visibilityStatus === "unlisted"
                  ? " Anyone with the link can watch an unlisted video."
                  : " Public videos can be watched by anyone."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {progress && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="text-sm font-medium">{progressLabel()}</div>

            {progress.stage === "done" && progress.video_id && (
              <div className="space-y-2">
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(progress.video_id)}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={async (event) => {
                    event.preventDefault();
                    setBrowserError("");
                    try {
                      await window.electronAPI.openExternal(
                        event.currentTarget.href
                      );
                    } catch {
                      setBrowserError(
                        "Could not open your browser. Copy the link and open it in your browser."
                      );
                    }
                  }}
                >
                  Open on YouTube
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
                {browserError && (
                  <p role="alert" className="text-sm text-destructive">
                    {browserError}
                  </p>
                )}
              </div>
            )}

            {(progress.stage === "rendering" ||
              progress.stage === "uploading") && (
              <Progress value={progress.percent ?? 0} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing renders */}
      <Card>
        <details className="group/renders">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <div>
              <CardTitle>Existing rendered videos ({renders.length})</CardTitle>

              <CardDescription>
                Retry uploads without rendering again.
              </CardDescription>
            </div>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/renders:rotate-180"
            />
          </summary>
          <CardContent className="pt-4">
            <div className="mb-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={loadRenders}
                disabled={isRunning}
              >
                Refresh
              </Button>
            </div>
            {renders.length > 0 ? (
              <div className="flex flex-col divide-y rounded-lg border">
                {renders.map((render) => (
                  <div
                    key={render.path}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {render.name}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {(render.size / 1024 / 1024 / 1024).toFixed(2)} GB ·{" "}
                        {new Date(render.modifiedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUploadExisting(render)}
                        disabled={isRunning || !canPublish}
                      >
                        Upload
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.electronAPI.showInFolder(render.path)
                        }
                      >
                        Show in folder
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No rendered videos found.
              </div>
            )}
          </CardContent>
        </details>
      </Card>
    </div>
  );
}
