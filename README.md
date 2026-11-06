# Tempo

中文个人任务管理与学习日历，使用 React + Vite + TypeScript，通过 GitHub Pages 自动发布。

- Repository: https://github.com/Landyzml/tempo
- Website: https://landyzml.github.io/tempo/

## Personal, browser-only storage

Tasks, events and linked study sessions are stored in **IndexedDB in the current browser**. No login, Supabase project, API key, or server is required. Records are never committed to the repository or uploaded by the application. The public repository contains application code only.

Data survives reloads and normal browser restarts. Other browsers/devices have separate data. Clearing site data, deleting a browser profile, private browsing, or browser storage eviction can remove records. Data is not encrypted by Tempo; anyone with access to this browser profile can access it. Browser storage is scoped to the website origin, not a separate account.

Use **备份** in the header (or the workspace button at the bottom of navigation):

- **导出备份** downloads a versioned JSON file containing all tasks and events. Keep it somewhere safe.
- **导入备份** validates the complete file, then atomically adds new records. Existing IDs retain their local versions; imports never overwrite or delete existing records. A summary reports added/skipped counts. To move to a different browser/device, export and import there.
- **请求浏览器持久保存** asks the browser to reduce automatic eviction risk. Approval is browser-controlled and does not prevent deliberate clearing. Backups are still necessary.

Files are limited to 10 MB / 10,000 records and validated for dates, times, IDs, kinds and linked-task consistency. Invalid imports abort without changing existing data. Import is additive; it is not a destructive “replace everything” restore.

Storage writes are transactional. Session changes do not change task deadlines; deleting a task removes linked sessions in the same transaction. Creation/modification/completion timestamps are maintained. Other tabs on the same origin refresh through BroadcastChannel.

## Features

- Overview: workload counts, today's progress, four priority quadrants, upcoming deadlines and sessions.
- Today: due/scheduled tasks, incomplete overdue work, and today's events.
- Tasks: creation/edit/delete, complete/reopen, descriptions, deadline date/time, importance and manual urgency, search/filter/sort.
- Calendar: month/week/day, all 24 hours, date navigation, date picker, all-day events, derived deadline markers, multiple linked sessions, overlapping blocks, drag rescheduling and manual duration edits.
- Mobile navigation and a full-width day view. Weekly calendar scrolls horizontally on small screens.
- No focus timer, Pomodoro or focus statistics.

Timed events use a local calendar date and wall-clock start/end. They preserve that clock time across timezone changes, rather than representing a global UTC instant. Automatic urgency uses today/tomorrow dates. Recurring events, cross-midnight events, external calendar sync, drag-resize and cross-device automatic sync are not implemented.

## Development

Requires Node 24 LTS and pnpm 11.25.0:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173/tempo/`.

```sh
pnpm lint
pnpm test
pnpm build
pnpm check:dist
pnpm preview
```

No environment variables are required. Do not put personal records or backup files into the repository. Local preview and the production site are different origins and therefore have different databases: use export/import to move your records.

## GitHub Pages deployment

The repository is configured for GitHub Actions as the Pages source. Pushing to `main` runs `.github/workflows/deploy.yml`: locked dependency installation, lint, storage/backup tests, TypeScript/build, static asset checks, artifact upload and Pages deployment. It uses SHA-pinned official GitHub actions and GitHub's automatic token/OIDC; no deployment token or backend secrets are needed.

`vite.config.ts` sets `base: '/tempo/'`. The workflow publishes `dist/`. No server process runs on GitHub Pages.

Routes are hash-based, so direct entries, refreshes and browser back/forward work on static hosting:

- `/tempo/#/dashboard`
- `/tempo/#/today`
- `/tempo/#/tasks`
- `/tempo/#/calendar`

If assets return 404, verify the repository name/base path and that Pages publishes the built `dist` artifact. If Pages is disabled, choose Settings → Pages → Source → GitHub Actions, then run the workflow. A renamed repository or custom-domain root requires updating both Vite base and the prefix in `scripts/check-dist.mjs`.

## Tests

`pnpm test` uses fake-indexeddb to exercise the browser storage adapter without mocking persistence as an application feature. It checks reopening the database, independent deadlines and sessions, completion timestamps, cascading deletion, validated backups, restoration, duplicate handling, preservation of local edits, and rejection of invalid imports/dangling links. Route tests verify all four hash URLs.

The actual deployed browser is checked separately for task/event creation, editing/completion, reload persistence, backup export and responsive calendar rendering. Refer to the deployment result in the accompanying chat for which live checks have completed.

## Previous backend implementation

The preceding Supabase integration was replaced at the user's request with personal browser-only storage. No existing Supabase project was paused or modified. The original Supabase migration remains in `supabase/migrations/` as a historical reference only; it is not used by this build and must not be applied for this version. Earlier cloud code remains recoverable in Git history.

No remote personal data or existing accounts were imported. There was no configured Tempo cloud backend to migrate. Browser-only storage deliberately has no authentication or cloud-sync claims.
