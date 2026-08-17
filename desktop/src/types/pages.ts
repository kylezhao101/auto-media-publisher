import type {
    Session,
    User,
    AuthError,
} from "@supabase/supabase-js"


export type Page =
    | "publish"
    | "organization"

export type Organization = {
    id: string
    name: string
    created_at: string
}

export type OrganizationPageProps = {
    workspace: string
    organizations: Organization[]

    session: Session | null
    user: User | null
    loading: boolean

    signIn: (
        email: string,
        password: string,
    ) => Promise<{
        error: AuthError | null
    }>

    signOut: () => Promise<unknown>
}