import {
  useEffect,
  useState,
} from "react"

import type { Page } from "./types/pages"

import { PublishPage } from "./pages/PublishPage"
import { OrganizationPage } from "./pages/OrganizationPage"

import { CreateOrganizationDialog } from "./pages/organization/CreateOrganizationDialog"

import { useOrganization } from "./hooks/useOrganization"
import { useAuthStatus } from "./hooks/useGCPTokenAuthStatus"
import { useYouTubeConnection } from "./hooks/useYoutubeConnection"
import { useOrganizationAuditLogs } from "./hooks/useOrganizationAuditLogs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Building2,
  Plus,
  UserRound,
} from "lucide-react"


const CREATE_ORGANIZATION_VALUE =
  "__create_organization__"


function App() {
  const [page, setPage] =
    useState<Page>("publish")

  const [workspace, setWorkspace] =
    useState("local")

  const [
    createOrganizationOpen,
    setCreateOrganizationOpen,
  ] = useState(false)


  const organization =
    useOrganization()


  const {
    authStatus,
    importCredentials,
    refreshAuthStatus,
  } = useAuthStatus()


  const youtube =
    useYouTubeConnection(
      workspace,
      organization,
      {
        connected:
          Boolean(authStatus.token),

        channelId:
          authStatus.channelId,

        channelName:
          authStatus.channelName,

        channelHandle:
          authStatus.channelHandle,

        channelThumbnail:
          authStatus.channelThumbnail,
      },
    )

  const auditLogs =
    useOrganizationAuditLogs(
      workspace,
      organization,
    )

  const selectedOrganization =
    organization.organizations.find(
      (org) =>
        org.id === workspace,
    )


  const workspaceLabel =
    workspace === "local"
      ? "Personal"
      : selectedOrganization?.name ??
      "Select workspace"


  function handleWorkspaceChange(
    value: string | null,
  ) {
    if (
      value ===
      CREATE_ORGANIZATION_VALUE
    ) {
      setCreateOrganizationOpen(true)
      return
    }

    setWorkspace(
      value ?? "local",
    )
  }


  function handleOrganizationCreated(
    organizationId: string,
  ) {
    setWorkspace(
      organizationId,
    )

    setPage(
      "organization",
    )
  }


  function handlePublishPage() {
    setPage("publish")
  }


  function handleOrganizationPage() {
    setPage("organization")

    if (workspace === "local") {
      void youtube.refresh()
      return
    }

    void organization.refreshWorkspace(
      workspace,
    )

    void youtube.refresh()
    void auditLogs.refresh()
  }


  useEffect(() => {
    if (!organization.session) {
      setWorkspace("local")
    }
  }, [organization.session])


  useEffect(() => {
    if (workspace === "local") {
      return
    }

    const exists =
      organization.organizations.some(
        (org) =>
          org.id === workspace,
      )

    if (!exists) {
      setWorkspace("local")
    }
  }, [
    workspace,
    organization.organizations,
  ])


  useEffect(() => {
    function handleFocus() {
      if (page !== "organization") {
        return
      }

      if (workspace !== "local") {
        void organization.refreshWorkspace(
          workspace,
        )

        void youtube.refresh()
        void auditLogs.refresh()

      }
    }

    window.addEventListener(
      "focus",
      handleFocus,
    )

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus,
      )
    }
  }, [
    page,
    workspace,
    organization.session?.user.id,
    auditLogs.refresh
  ])


  return (
    <main className="min-h-screen bg-background text-foreground">

      <header className="bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">

          <h1 className="mr-auto text-base font-semibold">
            Auto Media Publisher
          </h1>


          <nav className="flex items-center rounded-lg bg-muted p-1">

            <button
              type="button"
              onClick={handlePublishPage}
              className={`
                rounded-md px-3 py-1.5
                text-sm font-medium
                transition-colors
                ${page === "publish"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              Publish
            </button>


            <button
              type="button"
              onClick={handleOrganizationPage}
              className={`
                rounded-md px-3 py-1.5
                text-sm font-medium
                transition-colors
                ${page === "organization"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              Organization
            </button>

          </nav>


          <Select
            value={workspace}
            onValueChange={
              handleWorkspaceChange
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue>
                <div className="flex items-center gap-2">

                  {workspace === "local" ? (
                    <UserRound className="size-4 text-muted-foreground" />
                  ) : (
                    <Building2 className="size-4 text-muted-foreground" />
                  )}


                  <span className="truncate">
                    {workspaceLabel}
                  </span>

                </div>
              </SelectValue>
            </SelectTrigger>


            <SelectContent>

              <SelectItem value="local">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" />

                  <span>
                    Personal
                  </span>
                </div>
              </SelectItem>


              {organization.organizations.map(
                (org) => (
                  <SelectItem
                    key={org.id}
                    value={org.id}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />

                      <span>
                        {org.name}
                      </span>
                    </div>
                  </SelectItem>
                ),
              )}


              <SelectSeparator />


              <SelectItem
                value={
                  CREATE_ORGANIZATION_VALUE
                }
              >
                <div className="flex items-center gap-2">
                  <Plus className="size-4 text-muted-foreground" />

                  <span>
                    Create organization
                  </span>
                </div>
              </SelectItem>

            </SelectContent>
          </Select>

        </div>
      </header>


      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 pb-5">

        <div
          className={
            page === "publish"
              ? "block"
              : "hidden"
          }
        >
          <PublishPage
            workspace={workspace}
            organization={organization}
            authStatus={authStatus}
            importCredentials={importCredentials}
            refreshAuthStatus={refreshAuthStatus}
            youtube={youtube}
          />
        </div>


        <div
          className={
            page === "organization"
              ? "block"
              : "hidden"
          }
        >
          <OrganizationPage
            workspace={workspace}
            organization={organization}
            authStatus={authStatus}
            youtube={youtube}
            auditLogs={auditLogs}
          />
        </div>

      </div>


      <CreateOrganizationDialog
        open={createOrganizationOpen}
        onOpenChange={
          setCreateOrganizationOpen
        }
        organization={organization}
        onCreated={
          handleOrganizationCreated
        }
      />

    </main>
  )
}


export default App