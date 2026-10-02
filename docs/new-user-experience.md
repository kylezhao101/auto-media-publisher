# New user experience backlog

Agreed starting point: implement #1 first. Keep the remaining priorities for later work.

1. **Guide YouTube setup** — explain the Personal credentials requirement, provide Google Cloud instructions, validate imported Desktop app JSON, guide Google sign-in, and confirm the destination channel. Initial implementation added; live Google sign-in still needs a desktop smoke test.
2. **Show exactly what's missing** — implemented a live checklist beside publishing: add clips, choose a thumbnail, connect YouTube, and confirm organization publishing permission. Each incomplete requirement has a direct action; completed items remain visible. Desktop interaction smoke test pending.
3. **Choose the right starting path** — implemented dismissible first-launch choices for Personal publishing, joining a team, and setting up a team. Personal opens YouTube setup; team flows guide sign-in, workspace selection/invitations, and creation. Setup choices and the selected workspace persist on this device; Getting started reopens the flow. Live desktop/auth smoke test pending.
4. **Use automatic rendering settings** — skipped at the user's request. Future option: detect available encoders, choose a suitable default, move manual controls under Advanced.
5. **Make publishing explicit** — implemented Render & upload to YouTube, with destination channel and visibility beside the action, an explanation of automatic upload, and stage-specific running labels. Private remains the default; presets can still set their own visibility. Desktop interaction smoke test pending.
6. **Improve metadata defaults** — empty fields with example placeholders or filename-based title suggestions; prevent accidental placeholder uploads.
7. **Reduce mandatory preparation** — generate a thumbnail from a frame or allow publishing without a custom thumbnail.
8. **Help users recover and return** — persist drafts, actionable errors, Open on YouTube after success, Save as preset.

Suggested first pass: #1, #2, #6, and #5. Then observe first-time users attempting a private upload.

Supporting flow: a dismissible checklist, Connect channel → Add media → Review → Publish, with contextual help.

## Setup verification

- Fresh Personal workspace: Set up YouTube opens the guide; sign-in stays disabled until credentials are imported.
- Cancel the file picker: show a neutral message and allow retry.
- Invalid JSON, service account, Web client, or incomplete Desktop client: reject without replacing existing credentials.
- Valid Desktop client: import succeeds; sign-in becomes available.
- Replacing credentials: clear the old authorization so the user signs in for the new client.
- Google sign-in: show waiting state, prevent duplicate actions, refresh authorization, and display the actual channel.
- Channel lookup failure: show an actionable error and allow Check channel or sign-in retry.
- Close and reopen: imported credentials and authorization remain available.
- Organization workspace: retain the existing organization connection flow.

## Publishing checklist verification

- Empty Personal draft: three missing requirements, with actions opening the clips picker, thumbnail picker, and YouTube setup.
- Selecting or removing clips and selecting a thumbnail updates completion and the remaining count.
- Cancelling a picker leaves its requirement incomplete.
- Complete Personal draft with authorization: Ready to start, with publishing enabled.
- Organization draft: include publishing permission; channel and role actions open the Organization page.
- Member without publishing permission: explain which roles can publish and who can grant access.
- Active job: checklist actions are disabled while Cancel job remains available.

## Starting path verification

- Fresh local storage: show the three starting choices before the publishing form.
- Personal: switch to Personal, show Publish, and open the YouTube setup guide.
- Join a team while signed out: show organization sign-in with team-specific guidance; after sign-in, show available organizations.
- Join with no organizations: explain accepting the invitation email using the signed-in account and provide Refresh workspaces.
- Selecting a team: open publishing in that workspace using its shared connection.
- Set up a team: sign in first, create an organization, then open its Organization page to connect YouTube.
- Back to choices and Continue later remain available; Getting started reopens the choices.
- Restart during joining or creation: restore that setup path and sign-in guidance.
- Restart after setup: open publishing and restore the remembered workspace after account and organization loading completes.
- Loading failure: allow retry and retain the remembered workspace preference.
- Deleted or inaccessible remembered organization: fall back to Personal after a successful organization list load.
- Sign-out: switch to Personal; never restore a team before validating access for the signed-in account.
