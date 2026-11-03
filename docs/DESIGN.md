# DevMemo design notes

The original design document for DevMemo (product scope, domain model, architecture and API design). For setup and usage, see the [README](../README.md).

# 1. Project Overview

## 1.1 What is DevMemo?

DevMemo is a lightweight, open-source Personal Developer Journal designed to help developers record, organize, and retrieve their daily development activities.

Developers work on multiple projects, investigate technical problems, make architectural decisions, fix bugs, implement features, and perform many other tasks throughout the day.

Although Git records code changes, it does not capture the complete context of a developer's work.

For example:

- Why was a particular implementation chosen?
- What problem was investigated today?
- Which technical decision was made?
- What was the developer working on yesterday?
- When was a specific feature implemented?
- What problems remain unresolved?
- What happened during the development of a particular project?

DevMemo aims to preserve this missing context.

It combines three sources of developer history:

1. **Developer Journal:** Manually written notes and daily activities.
2. **Git Activity:** Automatically collected commits and repository events.
3. **AI Assistant:** An intelligent interface for searching, understanding, and managing historical development information.

The goal is to create a personal memory system for software developers without introducing the complexity of traditional project-management platforms.

## 1.2 Core Philosophy

DevMemo is built around three principles:

- Git records what changed in the code.
- The Journal records what happened during development.
- AI helps developers understand and retrieve their history.

DevMemo is not intended to replace GitHub, Jira, Linear, Notion, or other development tools.

It provides a simple layer of personal memory that connects daily work with Git activity and AI assistants.

## 1.3 Main Objectives

- Maintain a structured daily development journal.
- Track workdays using a calendar.
- Automatically collect Git commit activity.
- Connect journal information to AI assistants through MCP.
- Search and summarize historical development activities.
- Allow AI assistants to add notes and update journal entries.
- Keep the application lightweight and easy to self-host.
- Avoid unnecessary infrastructure and operational complexity.

---

# 2. Product Scope

DevMemo is a personal developer journal, not a project-management SaaS.

The MVP should focus on a small set of features that work reliably.

## 2.1 Main Features

| Feature | Description | Priority |
|---|---|---|
| Calendar | Monthly calendar for viewing development activity | High |
| Workday Tracking | Manually mark a date as a workday | High |
| Daily Journal | Write and edit daily development notes | High |
| GitHub Integration | Automatically receive GitHub commit activity | High |
| Commit History | Display commits associated with each day | High |
| MCP Integration | Connect AI assistants to the journal | High |
| Journal Search | Search historical notes and activities | Medium |
| AI Summary | Generate summaries from notes and commits | Medium |
| Weekly Reports | Summarize weekly development activity | Future |
| Project Timeline | View development history by repository | Future |
| Telegram Integration | Add quick notes through Telegram | Future |
| Other Git Providers | Support GitLab and other providers | Future |

---

# 3. Technology Stack

DevMemo is a single Next.js application. The frontend, REST API, GitHub webhook endpoint and MCP endpoint all live in one deployable app. A separate backend service would add infrastructure without adding value for this scope.

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL |
| ORM | Prisma 7 with the `pg` driver adapter |
| Authentication | Better Auth, GitHub OAuth only |
| Validation | Zod (shared by REST, server actions and MCP tools) |
| Git integration | GitHub webhooks (push events) |
| AI integration | Model Context Protocol (Streamable HTTP) |

## 3.1 Multi-User, GitHub Sign-In

DevMemo is a hosted, multi-user application that can also be self-hosted.

- Users sign in with GitHub. There are no passwords, registration forms, email verification or reset flows.
- Every journal record (`Day`, `Note`, `Commit`) belongs to a user, and every query is scoped by `userId`.
- Each user has their own timezone (Settings), falling back to `APP_TIMEZONE`.
- In later phases, each user gets their own webhook secret and personal MCP token.

## 3.2 Database

PostgreSQL is the database. Journal dates are stored as Postgres `DATE` values, so a day is a calendar date with no time or timezone attached. Commit timestamps are converted to the user's timezone once, at ingestion time, to decide which day they belong to.

## 3.3 AI Integration

- Model Context Protocol (MCP)
- Claude Desktop, Claude Code and other MCP-compatible clients

AI remains optional. The journal works fully without any AI provider configured.

---

# 4. High-Level Architecture

The architecture should remain modular but simple.

```text
                   Developer
                       |
                       |
             +---------+---------+
             |                   |
             v                   v
         Next.js             GitHub
         Frontend            Webhooks
             |                   |
             | REST API          | Push Event
             |                   |
             v                   v
        +-----------------------------+
        |   Next.js (API + services)  |
        |                             |
        |  +-----------------------+  |
        |  | Journal Module        |  |
        |  +-----------------------+  |
        |                             |
        |  +-----------------------+  |
        |  | Git Module            |  |
        |  +-----------------------+  |
        |                             |
        |  +-----------------------+  |
        |  | MCP Module            |  |
        |  +-----------------------+  |
        |                             |
        |  +-----------------------+  |
        |  | AI Summary Service    |  |
        |  +-----------------------+  |
        +-----------------------------+
                       |
                       v
                 Prisma ORM
                       |
                       v
                  PostgreSQL
```

## 4.1 Architecture Principles

- Keep everything in one Next.js application.
- Use modules instead of introducing unnecessary architectural layers.
- Avoid microservices.
- Avoid distributed infrastructure.
- Keep the database as the single source of truth.
- MCP must use the same application services as REST APIs.
- Git ingestion must not depend on AI.
- AI must not be required for normal journal operations.

There is no need to introduce DDD, CQRS, Redis, RabbitMQ, BullMQ, vector databases, or a complex RAG pipeline in the MVP.

---

# 5. Core Domain Model

The central entity in DevMemo is a **Day**.

The calendar is only a visual representation of these daily records.

A developer can have a journal entry even without making any Git commits.

Likewise, a Git commit can exist even if the developer has not manually marked that date as a workday.

These are two separate concepts.

## 5.1 Day

Each calendar date can have one journal record.

Suggested fields:

| Field | Type | Description |
|---|---|---|
| id | String | Unique identifier |
| date | Date/String | Unique calendar date |
| isWorkDay | Boolean | Whether the developer marked this date as a workday |
| notes | Text | Manually written daily notes |
| summary | Text | Optional AI-generated summary |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

A Day has a one-to-many relationship with Commit.

## 5.2 Commit

Each Git commit should be stored separately.

Suggested fields:

| Field | Type | Description |
|---|---|---|
| id | String | Unique identifier |
| sha | String | Git commit SHA, unique |
| repositoryId | String | GitHub repository identifier |
| repositoryName | String | Repository full name |
| message | Text | Commit message |
| branch | String | Branch name |
| url | String | GitHub commit URL |
| committedAt | DateTime | Original commit timestamp |
| dayId | String | Related journal day |
| createdAt | DateTime | Database insertion timestamp |

The SHA must be unique to prevent duplicate commits when GitHub retries webhook deliveries.

## 5.3 Relationship

```text
Day
 |
 | 1
 |
 |----------------------|
 |                      |
 |                      |
Commit 1             Commit 2
```

A single day can contain multiple commits from multiple repositories.

Manual notes and imported commits must remain separate.

Git synchronization must never overwrite manual notes.

---

# 6. Calendar System

The calendar is the main entry point into DevMemo.

## 6.1 Monthly Calendar

The calendar should support:

- Viewing the current month.
- Navigating between months.
- Selecting a specific date.
- Identifying workdays.
- Identifying days with Git activity.
- Opening the journal for a selected date.

## 6.2 Calendar Indicators

Two different indicators should be used.

**Workday indicator**

Shows that the developer manually marked the date as a workday.

**Git activity indicator**

Shows that one or more commits were associated with the date.

These indicators must remain independent.

Example:

| Date | Workday | Git Activity |
|---|---|---|
| Monday | Yes | Yes |
| Tuesday | Yes | No |
| Wednesday | No | Yes |
| Thursday | No | No |

This distinction is important because a developer may work without committing code or push previously created commits on a different day.

## 6.3 Workday Management

The developer should be able to:

- Open a calendar date.
- Mark it as a workday.
- Unmark it.
- Add daily notes.
- View imported Git activity.

The calendar should not require the user to create a complex task or project structure.

---

# 7. Daily Journal

The Daily Journal is the most important part of DevMemo.

Each date should have a simple journal page.

## 7.1 Journal Interface

A daily journal page should contain:

1. Date.
2. Workday status.
3. Manual notes editor.
4. Git activity list.
5. Optional AI-generated summary.

Example:

```text
------------------------------------
Monday, November 2, 2026

[✓] Workday

------------------------------------
Daily Notes

Worked on the SMC backend.
Investigated webhook authentication.
Improved the QA request handling.

------------------------------------
Git Activity

Repository: SMC

- Fix webhook authentication
- Improve QA request handling
- Update backend configuration

------------------------------------
AI Summary

Worked on backend improvements,
including webhook authentication
and QA request handling.
------------------------------------
```

## 7.2 Manual Notes

The developer should be able to write anything relevant to the workday:

- Development activities.
- Technical investigations.
- Architectural decisions.
- Problems and blockers.
- Ideas.
- Completed work.
- Unfinished tasks.
- Important observations.

Notes should be editable at any time.

## 7.3 Git Activity

Imported commits should appear in a separate section.

The application must not mix manually written notes with automatically imported Git information.

This separation preserves the original source of each piece of information.

---

# 8. GitHub Integration

GitHub integration should automatically collect development activity.

The first implementation should use GitHub Webhooks rather than polling repositories continuously.

## 8.1 Webhook Workflow

```text
Developer
    |
    | git push
    v
GitHub Repository
    |
    | Push Event
    v
GitHub Webhook
    |
    v
Next.js Git Controller
    |
    v
Verify Webhook Signature
    |
    v
Parse Commit Information
    |
    v
Determine Commit Date
    |
    v
Find or Create Journal Day
    |
    v
Save Commit Records
    |
    v
PostgreSQL Database
```

## 8.1.1 Implementation

- Each user has one webhook endpoint: `POST /api/webhooks/github/:hookId`, with its own secret (AES-256-GCM encrypted at rest).
- The same URL and secret can be added to any number of repositories or organizations.
- **Only my commits** (default on) skips commits by other authors in shared repositories, matched by GitHub username, account email and GitHub noreply addresses.
- `ping` is acknowledged, `push` is ingested, other events are ignored (202). Branch deletions and tag pushes are ignored.
- The last delivery's status is shown in Settings, which helps debug signature or content-type problems.

## 8.2 Webhook Event

Initially, subscribe only to:

```text
push
```

A push event may contain multiple commits.

The backend should process all relevant commits.

## 8.3 Commit Information

Extract:

- Commit SHA.
- Commit message.
- Commit timestamp.
- Repository ID.
- Repository name.
- Branch or ref.
- Commit URL.
- Author information if useful.

The MVP should not store full Git diffs.

Storing commit metadata is sufficient for the initial journal functionality.

## 8.4 Webhook Security

GitHub webhook requests must be verified using:

```text
X-Hub-Signature-256
```

The backend should:

- Use the configured webhook secret.
- Validate the HMAC signature.
- Use the raw request body for signature verification.
- Reject invalid signatures.
- Validate the payload structure.
- Avoid logging secrets.
- Avoid storing unnecessary sensitive payload information.

## 8.5 Idempotency

GitHub may retry webhook deliveries.

The backend must prevent duplicate commits.

Use the commit SHA as a unique identifier.

If a commit already exists, do not insert another record.

This makes webhook processing idempotent.

## 8.6 Date Handling

The journal date should be determined using the original commit timestamp, not the webhook delivery time.

The application should support a configurable timezone.

Example:

```env
APP_TIMEZONE="Europe/Berlin"
```

The timezone must not be hardcoded.

The backend should convert commit timestamps to the configured timezone before assigning a journal date.

This is important for commits close to midnight.

## 8.7 Important Architectural Rule

Claude or another AI assistant must not participate in the Git ingestion process.

GitHub Webhook → Next.js → Database

This process must work independently.

AI and MCP are separate interfaces that read and update the journal later.

---

# 9. MCP Integration

MCP is one of the most important features of DevMemo.

It allows an AI assistant to interact directly with the developer's historical journal.

Instead of manually opening calendar dates and searching notes, the developer can ask natural-language questions.

## 9.1 MCP Architecture

```text
Developer
    |
    v
Claude Desktop / Claude Code
    |
    v
MCP Client
    |
    v
DevMemo MCP Server
    |
    v
Next.js Application Services
    |
    v
Prisma
    |
    v
PostgreSQL
```

MCP is an adapter to the existing backend.

It must not introduce a separate database or duplicate journal business logic.

The MCP server should call the same services used by REST endpoints.

## 9.2 Initial MCP Tools

The first version should provide the following tools.

### get_day

Retrieve a complete journal entry for a specific date.

Input:

```json
{
  "date": "2026-11-02"
}
```

Output should include:

- Workday status.
- Manual notes.
- Git commits.
- AI summary, if available.

### get_month

Retrieve journal activity for a specific month.

Input:

```json
{
  "year": 2026,
  "month": 11
}
```

Useful for understanding monthly development activity.

### add_note

Add a note to a specific journal date.

Input:

```json
{
  "date": "2026-11-02",
  "note": "Investigated webhook authentication."
}
```

The tool should append the note without accidentally deleting existing notes.

### update_day

Update a journal date or its workday status.

Input:

```json
{
  "date": "2026-11-02",
  "isWorkDay": true
}
```

### get_commits

Retrieve commits for a particular date.

Input:

```json
{
  "date": "2026-11-02",
  "repository": "SMC"
}
```

The repository parameter should be optional.

### search_journal

Search historical journal information.

Input:

```json
{
  "query": "Telegram webhook authentication"
}
```

The initial implementation can use database text search.

A vector database or RAG system is not necessary for the MVP.

## 9.3 Example AI Interactions

The developer should be able to ask:

- What did I work on today?
- What did I work on yesterday?
- Summarize my development activities this week.
- What did I change in the SMC project?
- When did I last investigate Telegram webhook authentication?
- Which repositories did I work on last month?
- Show my recent Git activity.
- Add a note to yesterday's journal.
- Mark today as a workday.
- What technical problems did I investigate this week?

The AI assistant should retrieve information from DevMemo rather than inventing historical activity.

## 9.3.1 Implemented Tools

| Tool | Purpose |
|---|---|
| `get_today` | Today's date, yesterday and current week in the user's timezone |
| `get_day` | One full day: workday, notes (with source), commits, summary |
| `get_range` | Full days in a date range (max 62 days), for weekly summaries |
| `get_month` | Per-day counts for a month |
| `get_commits` | Commits for a date, optional repository filter |
| `search_journal` | Text search across notes, commits, repositories, summaries |
| `add_note` | Append a note (stored with source `MCP`, shown as "via AI") |
| `update_day` | Set workday flag and/or save a summary |

The server also sends instructions telling the assistant to answer only from tool data and never invent activity.

**Prompts** (shown as slash commands or templates in most clients):

| Prompt | Arguments | What it does |
|---|---|---|
| `weekly_report` | `week`: `this` (default), `last` or a date | Weekly report: highlights, by project, decisions, open items |
| `daily_standup` | `date` (default today) | Yesterday / Today / Blockers, using the last working day |
| `summarize_day` | `date` (default today) | Summarizes a day and saves it with `update_day` |

**Resources**: `devmemo://day/{date}` (one day as Markdown; the last 30 active days are listed) and `devmemo://week/current`.

## 9.4 MCP Transport

For the MVP, MCP can live inside the Next.js backend.

There is no need for a separate MCP microservice.

Possible transports:

- Streamable HTTP for remote MCP connections.
- STDIO for locally launched MCP processes.

The actual transport should be selected based on the compatibility requirements of the intended AI clients.

Claude Desktop and Claude Code integration should be tested before finalizing the transport.

**Implemented:** Streamable HTTP at `POST /api/mcp`, stateless (a fresh server per request, bound to the token's user), JSON responses.

## 9.5 MCP Security

**Implemented:** personal access tokens (`dm_…`), created and revoked in Settings. Only a SHA-256 hash is stored, and the token is shown once. The same tokens authenticate the REST API via `Authorization: Bearer`.


Read and write tools must validate their input.

If MCP is exposed remotely:

- Protect write operations with authentication.
- Do not expose unauthenticated journal modification.
- Keep credentials outside source control.
- Validate dates and text length.
- Avoid exposing sensitive journal data to unauthorized clients.

---

# 10. AI Summary

DevMemo can optionally generate summaries from daily journal information.

This feature should remain lightweight and optional.

## 10.1 Summary Workflow

```text
Developer requests summary
          |
          v
Next.js Journal Service
          |
          v
Load Daily Notes
          |
          v
Load Git Commits
          |
          v
Send relevant context to AI
          |
          v
Receive summary
          |
          v
Save summary in Day
```

## 10.2 Summary Requirements

The AI should:

- Summarize the developer's actual activities.
- Combine manual notes and commit messages.
- Identify important development topics.
- Highlight reported blockers when present.
- Avoid inventing completed tasks.
- Avoid inventing technical decisions.
- Avoid claiming that work was completed when the source only describes an investigation.

## 10.3 Cost Optimization

AI summaries should be generated on demand or explicitly at the end of the day.

Do not call an AI provider every time a commit arrives.

The application should work normally without AI configuration.

A possible endpoint:

```http
POST /journal/:date/summary
```

The resulting summary should be saved in the Day record.

---

# 11. REST API Design

The backend should expose a small REST API.

## 11.1 Journal APIs

### Retrieve a Daily Journal

```http
GET /api/journal/:date
```

Returns:

- Date.
- Workday status.
- Notes.
- Summary.
- Commits.

### Update a Daily Journal

```http
PATCH /api/journal/:date
```

Example:

```json
{
  "isWorkDay": true
}
```

### Retrieve Daily Commits

```http
GET /api/journal/:date/commits
```

### Retrieve Monthly Journal Data

```http
GET /api/journal/month/:year/:month
```

Returns calendar information for the selected month.

### Add a Note

```http
POST /api/journal/:date/notes
```

```json
{ "content": "Investigated webhook authentication." }
```

Notes are appended; existing notes are never modified.

### Edit or Delete a Note

```http
PATCH  /api/notes/:id
DELETE /api/notes/:id
```

### Search

```http
GET /api/journal/search?q=webhook&type=note,commit&from=2026-11-01&to=2026-11-30&repository=acme/api
```

### Export

```http
GET /api/export?format=md|json|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
```

### Generate Summary

```http
POST /api/journal/:date/summary
```

## 11.2 GitHub Webhook API

```http
POST /api/webhooks/github/:hookId
```

Receives GitHub push events.

## 11.3 Authentication and Response Format

All API routes require a signed-in session (cookie). MCP and webhook endpoints will use their own per-user credentials.

Success responses are `{ "data": ... }`. Errors are `{ "error": { "code", "message", "details?" } }` with matching HTTP status codes (`400`, `401`, `404`, `500`).

## 11.4 API Design Principles

- Keep endpoints simple.
- Validate all inputs.
- Use consistent response structures.
- Avoid unnecessary endpoints.
- Keep journal operations independent from AI services.
- Ensure Git webhook processing is idempotent.

---

# 12. Project Structure

```text
DevMemo/
├── prisma/
│   └── schema.prisma          # User/Session/Account (auth) + Day/Note/Commit
├── prisma.config.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # GitHub sign-in page
│   │   ├── (dashboard)/        # Signed-in area
│   │   │   ├── calendar/
│   │   │   ├── journal/[date]/
│   │   │   ├── journal/today/  # Redirects to today in the user's timezone
│   │   │   ├── search/
│   │   │   ├── settings/
│   │   │   └── actions.ts      # Server actions used by the UI
│   │   └── api/
│   │       ├── auth/[...all]/  # Better Auth
│   │       ├── journal/        # REST API
│   │       ├── notes/[id]/
│   │       ├── mcp/            # MCP endpoint (Streamable HTTP)
│   │       └── webhooks/github/[hookId]/
│   ├── components/             # calendar, journal, layout, ui
│   ├── lib/                    # dates, validation (client-safe)
│   ├── server/                 # server-only: db, auth, session, services
│   │   ├── journal.service.ts  # Single source of journal business logic
│   │   ├── api-token.service.ts
│   │   ├── github/             # push parsing (pure, tested) + webhook service
│   │   ├── mcp/server.ts       # MCP tools → journal service
│   │   └── ...
│   └── proxy.ts                # Optimistic auth redirect
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 12.1 Layering Rule

`src/server/journal.service.ts` is the only code that reads or writes journal data. REST route handlers, server actions, the GitHub ingester (phase 2) and MCP tools (phase 3) are thin adapters over it. Each adapter authenticates, validates input with the shared Zod schemas, and calls the service.

## 12.2 Data Model

- **Day**: one row per user per date (`@@unique([userId, date])`), created lazily. Holds `isWorkDay` and the optional `summary`.
- **Note**: separate rows, never one big text field. UI edits and AI/MCP appends can't overwrite each other, and each note records its `source` (`MANUAL`, `MCP`, `TELEGRAM`).
- **Commit**: Git metadata, unique per `(userId, sha)`, so retried webhook deliveries are idempotent.

---

# 13. Frontend

The UI is intentionally minimal:

- Monthly calendar with independent workday, Git activity and notes indicators.
- Daily journal page: workday toggle, notes timeline (add, edit, delete), Git activity grouped by repository, optional AI summary.
- Search across notes, commit messages, repositories and summaries.
- Settings: timezone and integration status.

Pages that read the session or the database render inside `<Suspense>` boundaries, as required by Cache Components.

---

# 14. Configuration

See `.env.example`:

```env
DATABASE_URL="postgresql://devmemo:devmemo@localhost:5432/devmemo?schema=public"
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
APP_TIMEZONE="UTC"
```

Environment variables are validated at startup, and misconfiguration fails with a readable error.

Secrets must never be committed. `.env.example` contains placeholders only.

---

# 15. Reliability and Security

The following requirements are important even for a small application.

## 15.1 Data Integrity

- Every calendar date should have at most one Day record.
- Every Git commit should be stored only once.
- Commit SHA should be unique.
- Git synchronization must not overwrite manual notes.
- AI summaries should be stored separately from original notes.

## 15.2 Webhook Reliability

- Verify every webhook signature.
- Handle duplicate deliveries.
- Validate incoming payloads.
- Handle empty commit lists.
- Handle deleted branches and unusual push events.
- Use original commit timestamps.
- Avoid relying on webhook delivery time.

## 15.3 AI Reliability

- Journal functionality must not depend on AI.
- MCP errors must not affect stored journal data.
- AI failures must not delete or modify original notes.
- Summaries must be based on actual stored information.

## 15.4 Deployment

GitHub webhooks require a publicly reachable HTTPS endpoint.

For local development, use a secure temporary tunnel or a development deployment.

The application should also consider persistent database storage before production deployment.

---

# 16. Development Roadmap

The project should be implemented incrementally.

## Phase 1: Core Journal

Goal: Build a functional developer journal without GitHub or AI. **Status: done.**

Tasks:

1. ✅ Set up the Next.js application.
2. ✅ Configure Prisma with PostgreSQL.
3. ✅ Create User, Day, Note and Commit models.
4. ✅ Sign in with GitHub (Better Auth).
5. ✅ Implement the journal service and REST API.
6. ✅ Implement the monthly calendar.
7. ✅ Implement the daily journal (notes, workday toggle).
8. ✅ Implement search and timezone settings.

**Expected result:** A usable personal developer journal.

## Phase 2: GitHub Integration

Goal: Automatically import development activity.

Tasks:

1. Create GitHub webhook endpoint.
2. Configure webhook signature verification.
3. Parse push events.
4. Extract commit metadata.
5. Convert commit timestamps to the configured timezone.
6. Find or create the corresponding Day.
7. Save commits.
8. Implement duplicate detection.
9. Display Git activity in the frontend.

**Expected result:** Daily journals automatically include GitHub activity.

## Phase 3: MCP Integration

Goal: Allow AI assistants to access and modify the journal.

Tasks:

1. Implement MCP server.
2. Register initial MCP tools.
3. Connect tools to JournalService.
4. Implement read operations.
5. Implement write operations.
6. Validate MCP inputs.
7. Connect Claude Desktop or Claude Code.
8. Test natural-language interactions.

**Expected result:** AI assistants can interact with developer history.

## Phase 4: AI Summaries

Goal: Generate useful summaries from journal information.

Tasks:

1. Add optional AI provider configuration.
2. Implement summary generation service.
3. Retrieve daily notes and commits.
4. Generate summaries on demand.
5. Save summaries.
6. Display summaries in the frontend.

**Expected result:** Developers can generate summaries of their daily work.

---

# 17. Testing Strategy

Testing should focus on important data and integration boundaries.

## 17.1 Journal Tests

- Create a journal day.
- Retrieve an existing day.
- Update workday status.
- Update notes.
- Preserve notes when Git commits arrive.
- Retrieve monthly calendar information.

## 17.2 GitHub Tests

- Valid webhook signature.
- Invalid webhook signature.
- Single commit.
- Multiple commits.
- Duplicate commit SHA.
- Empty commit list.
- Multiple repositories.
- Timezone boundary.
- Commit close to midnight.
- Retry webhook delivery.

## 17.3 MCP Tests

- Retrieve a journal day.
- Retrieve monthly activity.
- Add a note.
- Update workday status.
- Retrieve commits.
- Search journal entries.
- Reject invalid inputs.
- Protect write operations.

## 17.4 AI Tests

- Generate a daily summary.
- Handle missing AI configuration.
- Handle provider errors.
- Ensure summaries do not overwrite original notes.
- Ensure summaries do not invent activities.

---

# 18. Future Features

The following features may be considered after the MVP is stable.

They should not be included in the initial implementation unless there is a clear requirement.

## 18.1 Weekly and Monthly Reports

Generate reports based on:

- Daily notes.
- Git commits.
- Repository activity.
- Technical investigations.

## 18.2 Project Timeline

View development history for a specific repository.

Example:

```text
SMC
 |
 +-- October 20
 |     Backend authentication investigation
 |
 +-- October 21
 |     Webhook implementation
 |
 +-- October 22
       QA optimization
```

## 18.3 Advanced Journal Search

Improve searching across:

- Notes.
- Commit messages.
- Repository names.
- Historical summaries.

Start with database search.

Only consider semantic search or embeddings if real usage demonstrates that ordinary search is insufficient.

## 18.4 Telegram Quick Notes

Allow the developer to send short notes through Telegram.

Example:

```text
/devmemo I investigated the new MCP transport today.
```

This can be implemented later as another input channel.

## 18.5 Additional Git Providers

Potential future integrations:

- GitLab.
- Bitbucket.
- Self-hosted Git services.

## 18.6 Export

Allow users to export their journal as:

- Markdown.
- JSON.
- CSV.

## 18.7 MCP Resources and Prompts

Future MCP improvements may include:

- Journal resources.
- Monthly development summaries.
- Predefined prompts.
- Project-specific context.

---

# 19. What DevMemo Should NOT Become

To protect the original concept, avoid introducing unnecessary complexity.

DevMemo should not become:

- A Jira alternative.
- A complete project-management system.
- A task-management SaaS.
- A team collaboration platform.
- A complex analytics platform.
- A multi-agent AI system.
- A RAG infrastructure project.
- A microservices architecture.

The primary objective is to preserve and retrieve personal development history.

A small application that works reliably is more valuable than a large application with unnecessary infrastructure.

---

# 20. Open-Source Strategy

DevMemo is intended to be an open-source project.

## 20.1 Repository Description

Suggested GitHub description:

An open-source personal developer journal that tracks daily work, Git activity, and connects with AI assistants through MCP.

## 20.2 License

MIT License is the proposed licensing choice.

The license should be explicitly added and confirmed before the first public release.

## 20.3 Recommended Repository Files

```text
README.md
LICENSE
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
.env.example
.gitignore
```

## 20.4 Contribution Principles

- Keep pull requests focused.
- Avoid unnecessary dependencies.
- Include tests for important changes.
- Document new integrations.
- Never commit personal journal databases.
- Never commit API keys or webhook secrets.
- Keep the project easy to run locally.

The README should clearly distinguish implemented features from planned roadmap items.

---

# 21. Final Product Definition

DevMemo is a lightweight personal developer memory system.

It connects three important elements:

1. Daily developer notes.
2. Automatically collected Git activity.
3. AI assistants through MCP.

The application should be simple enough to run locally, flexible enough to integrate with different AI clients, and structured enough to preserve development history over time.

Its most important characteristic is that it does not require AI to function.

Git activity is collected automatically.

Daily notes are stored independently.

AI assistants access the same historical information through MCP.

The database remains the source of truth.

**DevMemo helps developers remember not only what they changed, but also what they did, investigated, decided, and learned.**

---

# 22. Implementation Priorities

The following priorities should guide all implementation decisions.

| Priority | Requirement |
|---|---|
| P0 | Reliable daily journal |
| P0 | Workday calendar |
| P0 | Next.js application |
| P0 | Prisma + PostgreSQL |
| P1 | GitHub webhook integration |
| P1 | Commit synchronization |
| P1 | MCP server |
| P1 | Claude integration |
| P2 | AI daily summaries |
| P2 | Journal search improvements |
| P3 | Weekly/monthly reports |
| P3 | Additional Git providers |
| P3 | Telegram quick notes |

**Final development principle: Build the journal first, connect Git second, and add AI through MCP third.**