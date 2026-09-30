# AGENTS.md

Guidance for AI coding agents (Codex, Claude Code, and others) working in this repository. `CLAUDE.md` imports this file, so there is one source of truth.

## What this is

**My Trackers** is a personal, Notion-style tracker app for one person (the repo owner). It covers:
- habits
- chores, appointments and keeping in touch with friends ("every N days" items)
- tasks with reminders
- a shopping list, workouts, Spanish practice and creative projects
- a daily email digest

Finances live in a separate, self-hosted **Actual Budget**. This repo also contains the kit for hosting it on an old laptop.

- **Frontend:** plain HTML/CSS/JS, with **no build step and no framework**. Opening `index.html` works offline (local-only mode).
- **Hosting:** Vercel. It serves static files plus two serverless functions in `api/`.
- **Sync and auth:** Supabase. Email magic link or 6-digit code, with one JSON document per user in `public.user_state`.
- **Email:** Resend, triggered by Vercel Cron once a day.

## Layout

```
index.html, styles.css      page shell and all styling (light + dark tokens on :root)
app.js                      the app: state, templates, rendering, events (one IIFE)
core.js                     shared pure logic (dates, recurring status, due items, digest). UMD:
                            window.TrackerCore in the browser, require('../core.js') in api/
cloud.js                    optional Supabase sync (window.Cloud); inactive without /api/config
api/config.js               returns public Supabase URL + publishable key
api/digest.js               daily email (Vercel Cron, Bearer CRON_SECRET) + "send test email" (user JWT)
supabase/schema.sql         table + row-level security policies
vercel.json                 cron schedule + headers
tests/*.test.js             unit tests (node:test) for core.js and api/digest.js
tests/e2e/*.e2e.js          browser tests (Playwright); sync test mocks Supabase
server/                     home-server kit: Ubuntu setup, Actual Budget compose, backups, guide
tools/server-check/         read-only "is this old computer fit to run 24/7?" scripts
docs/                       finances guide, deploy runbook
```

## Commands

```bash
npm test            # unit tests, no dependencies needed (Node 18+)
npm run test:e2e    # browser tests; needs Playwright + Chromium:
                    #   npm i -g playwright && npx playwright install chromium
                    #   (sync test also needs: npm i -g @supabase/supabase-js, else it is skipped)
node --check app.js core.js cloud.js api/*.js   # quick syntax check
```

Run **both** test suites before pushing UI changes. E2E tests can save screenshots to the temp folder `OUT` from `tests/e2e/helpers.js` (`app.e2e.js` saves `phone.png`).

## Conventions

- **Keep it build-free.** No bundlers, TypeScript or npm runtime dependencies in the frontend. The only external script is supabase-js from jsdelivr, loaded on demand by `cloud.js`.
- **Match the existing style:** 2-space indent, single quotes, template-literal rendering, and `data-action` attributes handled by one delegated click listener in `app.js`.
- **Escape everything.** Any user or synced data that goes into HTML must pass through `esc()`, and links through `safeUrl()` (http/https only) or `safeLink()` (also app schemes; blocks `javascript:`/`data:`). Imported and synced data is coerced in `normalize()` (ids, colors, dates, numbers). Keep it that way, and extend `tests/e2e/security.e2e.js` when adding fields.
- **Tracker kinds:** `habit`, `recurring` and `database`. New trackers are added in `TEMPLATES`; `DEFAULT_TRACKERS` controls the first-run set.
- **Shared logic** that the email digest also needs belongs in `core.js`, not `app.js`.
- **Re-rendering** is a full `render()` that restores focus by `data-key` or by the element's data attributes (`focusKey`). New focusable controls should carry identifying `data-*` attributes.
- **Phone layout matters.** The owner uses this on a phone. Check at 390px width with no horizontal page scroll (the e2e tests assert this).
- **`tools/server-check/check-server.ps1` and `server/windows/*.ps1` must stay pure ASCII** (Windows PowerShell 5.1 misreads UTF-8 without a BOM). `check-server.sh` must stay bash 3.2 compatible (macOS).
- **Never commit secrets.** Keys live in Vercel environment variables (see the README table).

## Working alongside other agents

- Work on your own branch and open a PR. Don't push to or rewrite another agent's branch.
- Keep PRs focused, and describe user-visible changes in plain language (the owner is not a developer).
- Update `README.md` when behavior the owner sees changes.

## Status and open items

- **Deploy:** not yet live. Follow [`docs/deploy-runbook.md`](docs/deploy-runbook.md), which can be done in the dashboards or entirely via APIs.
- **Home server:** the owner has an old laptop and hasn't yet run `tools/server-check` on it. Its report decides the setup: Ubuntu alongside Windows (A), replace Windows (B), or keep Windows (C). See `server/README.md`.
- **Idea, nice-to-have:** show product results inside the Shopping List (Best Buy and eBay have free APIs; Amazon's API needs an affiliate account with sales), plus link previews for pasted URLs.
