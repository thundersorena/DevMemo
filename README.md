<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-dark.png">
    <img src="public/brand/logo-light.png" alt="DevMemo" height="64">
  </picture>
</p>

<h1 align="center">DevMemo</h1>

<p align="center">
  <strong>Your developer memory, connected.</strong><br>
  An open-source developer journal that puts your daily notes, your Git activity and your AI assistant on one calendar.
</p>

<p align="center">
  <a href="https://devmemo.phdev.ir">Live demo</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#connect-an-ai-assistant-mcp">MCP setup</a> ·
  <a href="#self-hosting">Self-hosting</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-336791">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-OAuth%202.1-7c3aed">
</p>

---

## Table of contents

- [Why DevMemo?](#why-devmemo)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Connecting Git](#connecting-git)
- [Connect an AI assistant (MCP)](#connect-an-ai-assistant-mcp)
- [Using DevMemo](#using-devmemo)
- [REST API](#rest-api)
- [Self-hosting](#self-hosting)
- [Deploying to Vercel](#deploying-to-vercel)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why DevMemo?

Every developer does a lot of work in a day, and that work ends up scattered: commits on GitHub or GitLab, notes in random text files, decisions buried in chat threads with an AI assistant. When the daily standup, the weekly report, a client invoice or a performance review comes around, rebuilding *what did I actually do on Tuesday?* is slow and incomplete.

DevMemo gives every user a calendar. Each day on that calendar collects three things automatically:

- **Your notes**: what you worked on, decided, learned or got stuck on.
- **Your commits**: pushed from GitHub, GitLab or Bitbucket, filed under the right day in *your* time zone.
- **Your AI assistant's notes**: Claude, Cursor, ChatGPT or any other MCP client can read your journal and write to it while you work.

On top of that you get reports, a timeline per repository, full-text search and exports, all from data you own.

DevMemo is:

- **Open source** (MIT) and **self-hostable** with one `docker compose` command.
- **Multi-user**: sign in with GitHub; every user's data is isolated.
- **Low-friction**: commits arrive on their own; you only write what Git can't see.
- **Model-agnostic**: no built-in chatbot and no AI bill. Bring whichever assistant you already use through the open [Model Context Protocol](https://modelcontextprotocol.io).

## Features

| Area | What you get |
|---|---|
| 📅 **Calendar** | A monthly view of workdays, commit counts and notes per day. |
| 📝 **Daily journal** | A timeline of notes for each day, a day summary, and a "workday" flag. Notes show where they came from (manual or AI). |
| 🔗 **GitHub App** | One-click connection like Vercel's: pick repositories, and the last **90 days** of history are imported automatically. |
| 🪝 **Webhooks** | A manual GitHub webhook, plus **GitLab** and **Bitbucket** support, for repositories where you can't install the App. |
| 👤 **Only your commits** | Commits are matched to you by GitHub login and your commit emails, so team repositories don't flood your journal. |
| 🤖 **MCP server** | 8 tools, 3 prompts and 2 resources at `/api/mcp`, protected by **OAuth 2.1** (or a personal access token). |
| 📊 **Reports** | Weekly and monthly stats, a daily activity chart, activity per repository, copy or download as Markdown. |
| 🗂️ **Repository timelines** | Every commit to a repository, grouped by day, with that day's notes as context. |
| 🔍 **Search** | PostgreSQL full-text search with `"exact phrases"`, `OR` and `-exclude`, filtered by type, date range and repository. |
| 📦 **Export** | The whole journal or a date range as Markdown, JSON or CSV. |
| 🌗 **Light and dark** | Follows your system theme; works from 360 px phones up. |

## How it works

```text
 Browser ──── session cookie ────┐
 AI assistant ── Bearer token ───┤      ┌──────────────────────────────┐
 GitHub / GitLab / Bitbucket ────┴────▶ │  Next.js app                 │
          (signed push webhooks)        │  pages · /api · /api/mcp     │
                                        │          │                   │
                                        │   service layer (src/server) │
                                        │          │                   │
                                        │   Prisma Client              │
                                        └──────────┬───────────────────┘
                                                   ▼
                                              PostgreSQL
```

One Next.js application serves the web UI, the REST API, the webhook receivers and the MCP server. All of them call the same service layer, so a rule like *"which calendar day does this commit belong to?"* or *"a user only ever sees their own data"* is written exactly once.

**A typical day:**

1. You push commits. GitHub sends a signed webhook; DevMemo verifies it, keeps only your commits, converts each timestamp to your time zone and files it under the right day.
2. While coding you tell your assistant *"note that I fixed the payment bug by retrying the webhook"*. It calls the `add_note` tool.
3. Next morning you ask *"write my standup"*. The `daily_standup` prompt reads yesterday and today and drafts it.
4. On Friday you open **Reports** and copy the week as Markdown.

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Route Handlers, Cache Components) |
| UI | React 19, Tailwind CSS 4, Geist font |
| Database | PostgreSQL 17 |
| ORM | [Prisma 7](https://www.prisma.io) with `@prisma/adapter-pg` |
| Auth | [Better Auth](https://www.better-auth.com) (GitHub sign-in, sessions, OAuth 2.1 provider via `@better-auth/mcp` and `@better-auth/cimd`) |
| AI protocol | [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (Streamable HTTP, stateless) |
| Validation | Zod 4 |
| Tests | Vitest |
| Hosting | Vercel, or Docker anywhere |
| Package manager | npm (enforced) |

## Quick start

**Requirements:** Node.js **20.19+**, npm, and Docker (for the local database) or any PostgreSQL 14+.

```bash
# 1. Clone
git clone https://github.com/thundersorena/DevMemo.git
cd DevMemo

# 2. Install dependencies (also generates the Prisma client)
npm install

# 3. Start PostgreSQL
docker compose up -d db

# 4. Configure the environment
cp .env.example .env
#    then fill in BETTER_AUTH_SECRET, GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (see below)

# 5. Create the database schema
npm run db:deploy

# 6. Start the dev server
npm run dev
```

Open <http://localhost:3000> and click **Continue with GitHub**.

### Create the GitHub OAuth App (required for sign-in)

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
2. Fill in:

   | Field | Value |
   |---|---|
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

3. Copy the **Client ID** and generate a **Client secret** into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
4. Generate the auth secret:

   ```bash
   openssl rand -base64 32
   ```

   and put it in `BETTER_AUTH_SECRET`.

In production, create a separate OAuth App with your public domain in both URLs.

## Configuration

All configuration is done with environment variables. Copy `.env.example` to `.env` and fill it in. The app validates every variable when it starts and tells you exactly which one is wrong.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | ✅ | At least 32 characters. Signs sessions and derives the key that encrypts webhook secrets. **Changing it signs everyone out and invalidates stored webhook secrets.** |
| `BETTER_AUTH_URL` | ✅ | The public URL of the app, e.g. `https://devmemo.example.com`. Use `https://` in production (enables secure cookies). Must not be `localhost` on a deployed app. |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App client ID (sign-in). |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App client secret. |
| `APP_TIMEZONE` | — | Default time zone (IANA name) for users who haven't picked one. Default: `UTC`. |
| `GITHUB_APP_ID` | — | GitHub App ID (numeric). |
| `GITHUB_APP_SLUG` | — | The App's URL name, from `github.com/apps/<slug>`. |
| `GITHUB_APP_CLIENT_ID` | — | GitHub App client ID. |
| `GITHUB_APP_CLIENT_SECRET` | — | GitHub App client secret. |
| `GITHUB_APP_WEBHOOK_SECRET` | — | The App's webhook secret. |
| `GITHUB_APP_PRIVATE_KEY` | — | The full contents of the App's `.pem` file (multi-line, `\n`-escaped, or base64). |

The six `GITHUB_APP_*` variables are all-or-nothing. If some are missing or the key can't be parsed, the GitHub App is disabled, **Settings** shows which variable is wrong, and the manual webhook keeps working.

## Connecting Git

### Option 1: GitHub App (recommended)

Users connect repositories in one click, and the last 90 days of history are imported automatically.

**One-time setup by the instance owner.** Create the App at <https://github.com/settings/apps/new>:

| Field | Value |
|---|---|
| Homepage URL | `https://your-domain` |
| Callback URL | `https://your-domain/api/github/app/callback` |
| Request user authorization (OAuth) during installation | ✅ (used to verify who owns the installation) |
| Webhook URL | `https://your-domain/api/webhooks/github-app` |
| Webhook secret | a random value: `openssl rand -hex 32` |
| Repository permissions → **Contents** | Read-only |
| Subscribe to events | **Push** |
| Where can this GitHub App be installed? | Any account |

Then, on the App's page:

1. Copy the **App ID**, **Client ID** and the slug from the public URL (`github.com/apps/<slug>`).
2. **Generate a new client secret.**
3. Under **Private keys**, click **Generate a private key**. A `.pem` file downloads. Paste its **entire contents**, including the `-----BEGIN … KEY-----` and `-----END … KEY-----` lines, into `GITHUB_APP_PRIVATE_KEY`.

> ⚠️ The `SHA256:…` string GitHub shows next to a key is its **fingerprint**, not the key. GitHub only lets you download the key once; if you've lost the file, generate a new one.

**For users:** **Settings → GitHub → Connect GitHub repositories**, choose *All repositories* or pick some, and you're done. Import progress is shown per repository.

### Option 2: Manual GitHub webhook

For repositories you can't install the App on, or instances without an App:

1. **Settings → GitHub → Advanced: manual webhook → Set up webhook.**
2. On GitHub: repository (or organization) → **Settings → Webhooks → Add webhook**
   - **Payload URL:** the URL shown in Settings
   - **Content type:** `application/json`
   - **Secret:** the secret shown in Settings (the same for all your repositories)
   - **Events:** *Just the push event*
3. GitHub sends a `ping` and the status in Settings turns green.

### Option 3: GitLab and Bitbucket

**Settings → GitLab & Bitbucket → Set up webhook**, then add the URL and secret to your project:

- **GitLab:** *Settings → Webhooks*, paste the URL, put the secret in **Secret token**, trigger **Push events**.
- **Bitbucket:** *Repository settings → Webhooks*, paste the URL and secret, trigger **Repository push**.

GitLab and Bitbucket commits are matched by email, so add the emails you commit with under **Settings → Your commit emails**. GitLab sends at most 20 commits per push and Bitbucket only a few per branch, so very large pushes are partially imported.

### Only your commits

By default DevMemo keeps only commits you authored, matched by your GitHub login, your account email and any extra emails you add in Settings. Turn off **Only import my commits** to keep everyone's commits from connected repositories.

> **Local development:** GitHub has to reach your machine to deliver webhooks. Expose port 3000 with a tunnel (for example `cloudflared tunnel --url http://localhost:3000`) and set `BETTER_AUTH_URL` to the tunnel URL.

## Connect an AI assistant (MCP)

DevMemo is a remote MCP server at:

```text
https://your-domain/api/mcp
```

It is protected with **OAuth 2.1**, so most clients need only that URL. The client discovers DevMemo's authorization server, opens your browser to sign in and approve access, and receives a short-lived token that only works for `/api/mcp`.

**Settings → AI assistants (MCP)** has copy-paste guides for Claude (claude.ai and desktop), Claude Code, ChatGPT, Cursor, VS Code, Windsurf, Gemini CLI and Codex CLI. A few examples:

**Claude Code**

```bash
claude mcp add --scope user --transport http devmemo https://your-domain/api/mcp
```

**Cursor** (`~/.cursor/mcp.json`) and **VS Code** (`.vscode/mcp.json`, key `servers`)

```json
{
  "mcpServers": {
    "devmemo": { "url": "https://your-domain/api/mcp" }
  }
}
```

**Claude (claude.ai / desktop):** *Settings → Connectors → Add custom connector*, paste the URL.

**Clients without OAuth:** create a **personal access token** in Settings and send it as a header:

```bash
claude mcp add --scope user --transport http devmemo https://your-domain/api/mcp --header "Authorization: Bearer dm_..."
```

Keep the command on one line (a trailing `\` doesn't continue lines in PowerShell). Treat tokens like passwords; revoke any token you've pasted somewhere public.

### What your assistant can do

| Type | Name | Description |
|---|---|---|
| Tool | `get_today` | Today's notes and commits, in your time zone |
| Tool | `get_day` | One day by date (`YYYY-MM-DD`) |
| Tool | `get_range` | A range of days |
| Tool | `get_month` | A month overview |
| Tool | `get_commits` | Commits, filtered by repository and date |
| Tool | `search_journal` | Full-text search with type, date and repository filters |
| Tool | `add_note` | Add a note to a day (marked as written by AI) |
| Tool | `update_day` | Set a day's summary or workday flag |
| Prompt | `daily_standup` | Draft a standup from yesterday and today |
| Prompt | `weekly_report` | Draft a weekly report |
| Prompt | `summarize_day` | Summarize one day |
| Resource | `devmemo://day/{date}` | A full day as Markdown |
| Resource | `devmemo://week/current` | The current week |

MCP tools aren't slash commands; just ask in plain language:

> "What did I do last Thursday?"
> "Add a note to today: switched the queue to SQS because of the retry limits."
> "Write my weekly report and save a one-line summary on each day."

You can see and disconnect every connected app under **Settings → AI assistants → Connected apps**.

<details>
<summary>OAuth details</summary>

- Discovery: `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728) → `/.well-known/oauth-authorization-server/api/auth` (RFC 8414).
- Client registration: Client ID Metadata Documents (the current MCP standard) and Dynamic Client Registration (RFC 7591).
- Authorization code with PKCE (S256), refresh tokens, consent screen at `/consent`.
- Access tokens are JWTs signed with keys published at `/api/auth/jwks` and audience-bound to the MCP resource.

</details>

## Using DevMemo

| Page | Path | What it's for |
|---|---|---|
| Landing | `/` | Public introduction |
| Calendar | `/calendar` | Monthly overview; click a day to open it |
| Today | `/journal/today` | Jump to today |
| Day | `/journal/YYYY-MM-DD` | Notes, commits, summary, workday flag |
| Reports | `/reports` | Weekly or monthly stats and charts; copy as Markdown |
| Repositories | `/repos` | Every repository with activity; open one for its timeline |
| Search | `/search` | Full-text search across notes, commits and summaries |
| Settings | `/settings` | Time zone, Git connections, commit emails, export, MCP and tokens |

**Search syntax:** `"exact phrase"`, `bug OR fix`, `-wip`. Short or partial words fall back to substring matching, which works in any language.

**Export:** *Settings → Export*, or `GET /api/export?format=md|json|csv&from=YYYY-MM-DD&to=YYYY-MM-DD`. CSV is UTF-8 with BOM and neutralizes spreadsheet formulas.

## REST API

Every endpoint accepts either the browser session or `Authorization: Bearer dm_…`, and only ever returns the caller's own data.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/journal/{date}` | One day with notes and commits |
| `PATCH` | `/api/journal/{date}` | Update a day's summary or workday flag |
| `POST` | `/api/journal/{date}/notes` | Add a note |
| `GET` | `/api/journal/{date}/commits` | Commits for a day |
| `GET` | `/api/journal/month/{year}/{month}` | Month overview |
| `GET` | `/api/journal/search?q=` | Search (`type`, `from`, `to`, `repository` filters) |
| `PATCH` | `/api/notes/{id}` | Edit a note |
| `DELETE` | `/api/notes/{id}` | Delete a note |
| `GET` | `/api/export?format=` | Export as `md`, `json` or `csv` |
| `POST` | `/api/webhooks/github-app` | GitHub App webhook (signed) |
| `POST` | `/api/webhooks/github/{hookId}` | Manual GitHub webhook (signed) |
| `POST` | `/api/webhooks/{gitlab\|bitbucket}/{hookId}` | GitLab / Bitbucket webhook |
| `POST` | `/api/mcp` | MCP endpoint (Streamable HTTP) |

Example:

```bash
curl -H "Authorization: Bearer dm_..." https://your-domain/api/journal/2026-11-02
```

## Self-hosting

The repository ships a multi-stage `Dockerfile` (standalone Next.js output, non-root user) and a `docker-compose.yml` with PostgreSQL.

```bash
cp .env.example .env
# Fill in the secrets and set BETTER_AUTH_URL to your public https:// URL.
# DATABASE_URL is set by docker-compose for the app container.

docker compose --profile app up -d --build
```

This starts PostgreSQL, applies all migrations, and runs DevMemo on port **3000**. Put a reverse proxy with HTTPS in front of it (Caddy, Nginx, Traefik), then set your domain in the GitHub OAuth App (and GitHub App, if you use one).

**Updating:**

```bash
git pull
docker compose --profile app up -d --build
```

Migrations run automatically before the app starts. Database data lives in the `devmemo-pg` volume; back it up with `pg_dump`.

## Deploying to Vercel

1. Create a PostgreSQL database (Neon, Supabase, Vercel Postgres or your own).
2. Import the repository in Vercel. Leave **Root Directory** empty; the framework is detected as Next.js.
3. Add the environment variables from [Configuration](#configuration). `BETTER_AUTH_URL` must be your production URL.
4. Apply migrations against the production database once (and after every schema change):

   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

5. Deploy. Vercel builds from your production branch (usually `main`).
6. Add your custom domain and update the callback URLs in your GitHub OAuth App and GitHub App.

Environment variable changes only apply to new deployments, so **redeploy** after changing them.

## Project structure

```text
src/
  app/
    (auth)/            login, OAuth consent
    (dashboard)/       calendar, journal/[date], reports, repos, search, settings
    api/               REST API, webhooks, MCP endpoint, auth handler
    .well-known/       OAuth discovery for MCP clients
    page.tsx           landing page
  components/          UI by feature (ui, layout, calendar, journal, reports, settings, …)
  server/              business logic (services), never imported by client code
    github/            push parsing, GitHub App (JWT, installations, backfill)
    git/               GitLab / Bitbucket adapters and webhooks
    mcp/               MCP server: tools, prompts, resources
  lib/                 pure, shared helpers (dates, validation, search text)
  styles/globals.css   design tokens (light and dark)
  proxy.ts             redirects signed-out users away from the dashboard
prisma/
  schema.prisma        data model
  migrations/          versioned SQL migrations
```

**Conventions:** pages and route handlers stay thin (validate input, resolve the user, call a service). Every service function takes a `userId`, so no query can run without being scoped to a user.

## Data model

```text
user ─┬─< session, account                    (Better Auth)
      ├─< day ─┬─< note                       (unique: userId + date)
      │        └─< commit                     (unique: userId + sha)
      ├── github_hook                         (1:1, manual webhook)
      ├─< provider_hook                       (one per GitLab / Bitbucket)
      ├─< github_installation ─< github_repository
      ├─< api_token                           (SHA-256 hash only)
      └─< oauth_client / oauth_*_token / oauth_consent   (MCP OAuth)
```

- A **day** is a real row, so summaries and workday flags have a home and the month view is a single query.
- Dates are stored as `date` and computed in the user's time zone: a commit at 23:30 in Tehran belongs to that day, not the previous one in UTC.
- `(userId, sha)` is unique: redelivered webhooks are idempotent, and two people on one repository each keep their own copy.
- Deleting a user cascades to all of their data.

## Security

- **Isolation:** every query is scoped by `userId`.
- **Webhooks:** HMAC-SHA256 signatures (GitHub, Bitbucket) and token header (GitLab), compared in constant time.
- **GitHub App installations** are linked only after verifying, through GitHub's user authorization, that the signed-in user can access the installation.
- **Secrets at rest:** webhook secrets are encrypted with AES-256-GCM; API tokens are stored as SHA-256 hashes and shown only once.
- **OAuth:** PKCE, consent screen, audience-bound JWT access tokens, revocable per app.
- **Sessions:** httpOnly cookies, `Secure` on HTTPS, 30-day lifetime refreshed daily.
- **Configuration:** environment variables are validated at startup; error messages name variables but never print their values.

Found a vulnerability? Please email the maintainer or open a private security advisory on GitHub instead of a public issue.

## Development

| Script | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Unit tests (Vitest) |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:studio` | Browse the database in Prisma Studio |

Before opening a pull request:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

> This project uses **npm** only (`preinstall` runs `only-allow npm`). Please don't commit `pnpm-lock.yaml` or `yarn.lock`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `redirect_uri is not associated with this application` | `BETTER_AUTH_URL` doesn't match the callback URL in your GitHub OAuth App. Set both to your public URL and redeploy. |
| `Invalid environment configuration` at startup | The message lists the variables to fix. |
| Settings: *GitHub App is disabled: … is not a PEM private key* | `GITHUB_APP_PRIVATE_KEY` doesn't contain a key, often the `SHA256:…` fingerprint was pasted. Paste the whole `.pem` file and redeploy. |
| Settings: *GitHub App is partially configured* | Set all six `GITHUB_APP_*` variables, or none. |
| Webhook status stays grey | GitHub can't reach your URL (local machine without a tunnel), or the secret doesn't match. Check *Recent Deliveries* on GitHub. |
| Commits from GitLab/Bitbucket are missing | Add the email you commit with under *Settings → Your commit emails*, or turn off *Only import my commits*. |
| Commits appear on the wrong day | Set your time zone in *Settings → Preferences*. |
| Vercel build fails on install | Remove any `pnpm-lock.yaml`/`yarn.lock` and make sure Root Directory is empty. |

## Roadmap

- [ ] Add notes from a Telegram bot (the `TELEGRAM` note source is already in the data model)
- [ ] Background queue for importing very large repositories
- [ ] Right-to-left UI and the Persian (Jalali) calendar
- [ ] End-to-end tests for sign-in and OAuth flows
- [ ] More Git providers (Gitea, Azure DevOps) through new adapters

Have an idea? [Open an issue](https://github.com/thundersorena/DevMemo/issues) and let's talk about it.

## Contributing

Contributions of every size are welcome: bug reports, docs, translations, new Git providers, new MCP tools, design improvements.

1. **Fork** the repository and create a branch: `git checkout -b feat/my-idea`
2. Make your change, and add tests for logic in `src/lib` or `src/server`.
3. Run `npm run typecheck && npm run lint && npm test`.
4. Commit with a clear message (e.g. `feat(search): filter by branch`) and open a **pull request** describing what and why.

For larger changes, please open an issue first so we can agree on the approach.

## ⭐ Support the project

If DevMemo is useful to you, or you just like the idea, **please give it a star** ⭐. It helps other developers find the project and keeps it going.

**Fork it**, run your own instance, build the feature you've been missing, and send it back. I'd be really happy to grow DevMemo together with you: every issue, idea and pull request makes it better for everyone.

<p align="center">
  <a href="https://github.com/thundersorena/DevMemo">⭐ Star DevMemo on GitHub</a> ·
  <a href="https://github.com/thundersorena/DevMemo/fork">🍴 Fork it</a> ·
  <a href="https://github.com/thundersorena/DevMemo/issues">💬 Open an issue</a>
</p>

## License

[MIT](LICENSE) © 2026 Pouya
