# Finances with Actual Budget

[Actual Budget](https://actualbudget.org) is a free, open-source budgeting app. It's the closest open-source match to Monarch:
- accounts and transactions
- envelope-style monthly budgets
- rules that categorize transactions automatically
- reports and net worth
- a web app that works on your phone

Your data stays on a server you control, and you can set a password on it.

## Why it's separate from the trackers app

Actual runs as a small server that stays on and stores your budget files. Vercel only runs short-lived functions and static pages, so it can't host Actual. You run Actual somewhere else and link to it from the trackers app (**Settings & reminders → Finances**).

## Hosting options

Prices are approximate at the time of writing. Check each provider.

| Option | Effort | Cost | Notes |
| --- | --- | --- | --- |
| **[PikaPods](https://www.pikapods.com)** | Easiest: a few clicks | Roughly $1–2/month | Managed hosting. Pick “Actual” from their app list. They handle updates and backups. |
| **[Fly.io](https://fly.io)** | Moderate: command line | Small (a few $/month or less) | Actual's docs have a step-by-step Fly guide. |
| **Your own computer or home server** | Moderate | Free | Docker: `docker run -d -p 5006:5006 -v actual-data:/data --restart unless-stopped actualbudget/actual-server:latest`. You'll need a way to reach it from your phone, such as Tailscale. |

Official install guides: https://actualbudget.org/docs/install/

After it's running:
1. Open it and set a server password.
2. Create a budget.
3. Copy the address (e.g. `https://your-pod.pikapod.net`) into **Settings & reminders → Finances** in the trackers app.

## Getting transactions in

- **Import files (free):** download CSV, OFX or QFX files from your bank and import them. Actual matches duplicates and applies your rules.
- **Automatic bank sync (optional):** Actual can connect to **[SimpleFIN Bridge](https://beta-bridge.simplefin.org)**, which covers US and Canadian banks for about $15/year. Set it up in Actual under *Settings → Bank Sync*. See https://actualbudget.org/docs/advanced/bank-sync for current providers.

## Suggested setup, in the spirit of Monarch

1. **Add accounts:** checking, savings, credit cards, and tracking-only accounts (investments, loans) for net worth.
2. **Set up categories:** Housing, Groceries, Eating out, Transport, Subscriptions, Fun, Savings goals.
3. **Add rules:** for example, anything containing “Starbucks” is categorized as Eating out.
4. **Budget monthly:** give every dollar a job at the start of the month and check the **Budget** screen weekly.
5. **Build a habit around it:** add a “Review budget” item to a recurring tracker in the app, every 1 week, so it shows up in your daily email when it's due.
