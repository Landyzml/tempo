# Tempo

中文任务管理与学习日历。The **same Tempo application** now builds as a React + Vite + TypeScript static frontend for GitHub Pages. Supabase provides email/password accounts and PostgreSQL storage. There is no SSR, server action, Worker, D1 binding, or `/api` process in the production application.

**Current status:** frontend build, lint, model tests and embedded PostgreSQL migration/RLS tests pass. No Supabase project or GitHub `tempo` repository has been configured. Live authentication, cloud saves, and GitHub Actions deployment have **not** been tested or published. Configuration is required before production use.

## Local setup

Use Node **24 LTS** and pnpm **11.25.0**:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in your Supabase project URL and public publishable key.
pnpm dev
```

Open `http://127.0.0.1:5173/tempo/`. Production-style preview:

```sh
pnpm lint
pnpm test
pnpm check:config
pnpm build
pnpm check:dist
pnpm preview
```

Without configuration, the application shows a setup screen. Its optional **查看界面示例** opens clearly labeled, ephemeral sample interactions, with no authentication or cloud writes. Refreshing clears the example. A failed cloud request never silently switches to sample records. Task/event records are not saved in localStorage. Supabase's SDK persists only its authentication session in browser storage.

## Supabase configuration

1. Create a Supabase project at [Supabase](https://supabase.com/dashboard). Keep its database password private.
2. In SQL Editor, run **`supabase/migrations/202611060001_tempo.sql` once**. It creates new `public.tasks` and `public.calendar_entries` tables in a transaction. If using the Supabase CLI with a linked project, apply it with your normal migration workflow instead; do not apply it twice.
3. Under Authentication → Providers, enable Email/password. Keep email confirmation enabled. Configure SMTP for production delivery and review password/rate-limit settings.
4. Under Authentication → URL Configuration, set Site URL to `https://YOUR_GITHUB_USERNAME.github.io/tempo/`. Add that exact URL and `http://127.0.0.1:5173/tempo/` to allowed Redirect URLs. Add `http://localhost:5173/tempo/` only if using that local hostname.
5. Copy the project URL and **publishable** key from the project's Connect/API Keys panel. Legacy `anon` JWT keys are also accepted. Never use `sb_secret_…`, a `service_role` JWT, database password, or a management token in this frontend.
6. Set `.env.local` locally:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Restart Vite after changing variables. Vite substitutes public variables at **build time**, so updating GitHub configuration requires a new build/deployment. Public keys are expected to be visible in the JavaScript bundle; data security comes from authenticated identity plus database RLS.

Signup, login, logout, password reset email, and password changes use the Supabase SDK. Auth redirects return to the application base URL, not a nonexistent `/callback` server. The SDK handles the PKCE code in the query string; app navigation uses the hash. Open confirmation/recovery links in the **same browser** that requested them because PKCE uses a locally stored verifier. Email confirmation and recovery flows must be validated against the actual configured project before launch.

## Database design and isolation

- `tasks`: owner UUID, title, description, due date/time, importance, manual urgency, completion and server-managed timestamps.
- `calendar_entries`: owner UUID, independent event or linked session, date, start/end time, all-day status, category and related task UUID.
- Task deadline markers are derived from task due dates. Changing a session never changes the task deadline. Tasks can have multiple sessions.
- A composite foreign key `(related_task_id, user_id)` references `(tasks.id, tasks.user_id)`. This rejects cross-user links and orphan sessions. Deleting a task cascades to its sessions.
- RLS is enabled on **both** tables. Every SELECT/INSERT/UPDATE/DELETE is restricted to `auth.uid() = user_id`. Anonymous access is revoked. Database constraints validate title, kind, ownership relationship and time ranges. A trigger keeps IDs/owners/creation timestamps immutable and manages modification/completion timestamps.
- Indexes support owner/date and related-task lookups.
- Date-only values remain PostgreSQL dates. Sessions use local calendar date and wall-clock times; they do not shift on UTC conversion. They are not travel-aware absolute instants. Cross-day and recurring events are outside this implementation.

The original workspace had no StudyFlow repository or database credentials. The preceding Workers implementation was unpublished; its source and original D1 migration are preserved in the local sibling `work/tempo-legacy` backup, and the previous deliverable zip remains available. No accounts or production data were deleted. This migration does **not** import old StudyFlow identities/tasks. An import requires the old backend source/export and a separately reviewed user-ID mapping.

## GitHub repository and Pages

No GitHub username is hard-coded and no remote repository was assumed or created. Expected repository name: **`tempo`**.

1. Create an empty `tempo` repository on your GitHub account. Do not overwrite an unrelated repository. Choose visibility according to your GitHub Pages plan; remember Pages is a published website and frontend source/bundle is public information.
2. In repository Settings → Secrets and variables → Actions → **Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
     These are public values, not service credentials. The workflow rejects missing/placeholders/secret-key configuration before deploying.
3. Under Settings → Pages → Build and deployment → Source, select **GitHub Actions**.
4. After reviewing the project and authorizing publication, connect and push it:

```sh
git add .
git commit -m "Build Tempo for GitHub Pages with Supabase"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/tempo.git
git push -u origin main
```

Check `git remote -v` first; use `remote set-url` only when you intentionally mean to change an existing remote. A push to `main` triggers production deployment. To run manually, use Actions → Deploy Tempo to GitHub Pages → Run workflow.

5. Approve a `github-pages` environment deployment if your repository protection rules require it. After the workflow succeeds, open its returned deployment URL: `https://YOUR_GITHUB_USERNAME.github.io/tempo/`.

`.github/workflows/deploy.yml` uses SHA-pinned official checkout/setup-node/configure-pages/upload-pages-artifact/deploy-pages actions and a locked dependency install. Build gets `contents: read` and `pages: read`; only deploy gets `pages: write` and `id-token: write`. It uses GitHub's automatic token/OIDC, with no PAT or third-party deployment token.

`vite.config.ts` uses **`base: '/tempo/'`**. Assets compile to `/tempo/assets/...`. Change `base` and the `check-dist` prefix together if deliberately using a different repository name or custom-domain root.

### Routes and refreshes

- Overview: `/tempo/#/dashboard`
- Today: `/tempo/#/today`
- Tasks: `/tempo/#/tasks`
- Calendar: `/tempo/#/calendar`

These are hash routes. Browsers request `/tempo/` from GitHub Pages on direct entry and refresh; no server-side rewrite or copied 404 page is required. Back/forward and bookmarks update the selected section. Do not use bare `/tempo/tasks` paths.

## What to test on the configured production site

These **remain pending** until real infrastructure exists:

1. Sign up two test accounts, confirm emails, log in/out, reset/change a password.
2. As account A, create/edit/complete/reopen a dated task, a standalone event and multiple sessions. Refresh and sign back in; verify persisted values.
3. Move a session and confirm its task deadline stays unchanged. Delete the task and verify linked sessions are removed.
4. As account B, verify A's records cannot be read/changed and a forged link to A's task is rejected by the database.
5. Direct-open and refresh all four hash URLs. Check network requests use `/tempo/assets/`, and no `/api/records`, SSR endpoint or localhost backend is contacted.
6. Check month/week/day, date navigation, filters, mobile navigation and calendar editing on the actual Pages domain.

## Automated verification

`pnpm test` runs six tests, including a real embedded PostgreSQL (PGlite) integration test of the migration, RLS CRUD isolation, cross-owner/orphan rejection, immutable ownership, completion timestamps, date validation and cascading deletion. Test fixtures stub Supabase's `auth.users`/`auth.uid()` and roles **only in the in-memory test database**; they do not mock production authentication or prove hosted Supabase configuration.

Browser checks on the local production build: all four hash routes retained their selected section after refresh and re-entering the explicit UI example; calendar rendered 336 weekly half-hour slots. The 390px phone day view had 48 half-hour slots and no document overflow. Live cloud paths remain untested.

Other checks: TypeScript via build; ESLint; emitted static asset paths and absence of server artifacts. `pnpm check:config` checks configuration syntax and prevents secret keys/placeholders; it does not check network connectivity. A local static build is allowed without credentials for setup/visual review; the production workflow always requires valid-looking configuration.

## Troubleshooting

- **Workflow says configuration missing:** use repository Actions Variables with the exact names, then rerun. `.env.local` is intentionally ignored and is not uploaded to GitHub.
- **Pages 404:** enable GitHub Actions as the Pages source, confirm repo name `tempo` and base `/tempo/`, wait for a successful deploy, and use hash URLs. Publishing the source folder instead of `dist` will not work.
- **Assets 404:** check base path and case-sensitive filenames. Run `pnpm check:dist` after building.
- **Login/confirmation fails:** check allowed redirect URLs, email delivery/SMTP, project availability and public key. Use the same browser for PKCE recovery. Do not disable RLS to fix login.
- **Cloud records fail to load:** run the migration, check table names/schema/permissions in Supabase, verify the account is signed in, and use the visible Retry action. The app preserves edits in an open editor if a save fails.
- **RLS error:** confirm both `USING` and `WITH CHECK` policies exist and `user_id` matches the JWT user. Sessions must link to a task owned by that same user.
- **Changed environment values have no effect:** rebuild/redeploy; frontend variables are baked into static assets.
- **Local install mismatch:** use Node 24 and pnpm 11.25.0 with the checked-in lockfile. Do not commit `.env.local`, auth sessions, or credentials.

## Features and limits

The original Chinese dashboard, Today, task list and calendar remain. Includes task CRUD/completion, importance/urgency quadrants, search/filter/sort, independent events, multiple linked sessions, month/week/day, date navigation, all-day entries, drag rescheduling and manual duration edits. No Pomodoro or focus statistics. No external-calendar sync, recurrence, drag-resize, cross-midnight events, or realtime push between devices; refresh loads current cloud records.

## References

Configuration follows [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy), [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [public API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).
