# ✅ My Trackers

A personal, Notion-style workspace for the habits and routines you want to keep up with. It includes:
- chores
- language practice
- workouts
- creative projects
- keeping in touch with friends
- work and personal tasks
- haircuts and other appointments

It also links out to a self-hosted **Actual Budget** for finances.

- **No build step.** It's plain HTML, CSS and JS. Open `index.html` and it works offline, saving to that browser only.
- **Hosted on Vercel** (optional), which adds:
  - sign-in by email, with no password
  - sync between your phone and computer (Supabase)
  - a **daily email** listing what's overdue, due today or due tomorrow (Resend)

  On the free tiers this should cost **about $0/month**.

---

## What's inside

| Tracker (default) | Type | What it does |
| --- | --- | --- |
| ✅ Daily Habits | Habit | Check off each day, weekly goals, 🔥 streaks, 20-week heatmap |
| ☑️ Tasks | Table | Work & personal to-dos with **Due** dates, priorities, and a “Hide done” filter |
| 🧹 Chores | Every N days | **Last done → next due**, shown as overdue / due today / coming up |
| 🛒 Shopping List | Table | Items by store. Tap 🛒 to open the item's link, or search for it on Amazon, Target, Walmart, Costco and more |
| 💪 Workouts | Table | Type, minutes, effort and notes for each session |
| 🇪🇸 Spanish | Habit | Daily Duolingo lesson, flashcards, listening and speaking. Tap ↗ to open the app in one tap |
| 🎨 Creative Projects | Board | Projects by status: idea → in progress → done, with the next step |
| 👥 Friends & Family | Every N days | Who you haven't talked to in a while. Add a phone number to get 💬 Message (text or WhatsApp) and 📞 Call buttons |
| 💇 Haircuts & Appointments | Every N days | Haircut every 4 weeks, dentist every 6 months, and so on |

The **New tracker** menu has more templates: Vocabulary, Reading List, Mood Journal, Goals, and blank ones of each type.

**Home** gathers everything in one place:
- the **Due & coming up** list, with one-tap **Done** and **Complete** buttons
- today's habits
- a link to your Finances

**How to use it:**
- **Every-N-days trackers** (chores, friends, haircuts): tap **Done** when you do the thing, and the next due date is calculated for you. Click an item's name to change how often it repeats, add notes, or log an earlier date.
- **Tables:** edit cells inline, switch to the **Board** view, sort, search, and add columns (text, number, select, checkbox, date, rating, URL).
- **One-tap links:** give any habit a link (edit the habit, then *Link*) and a ↗ button appears on Home and in the week view. Most phone apps open straight from their website link.
- **Friends:** when adding a phone number, Android (Chrome) offers **Pick from contacts**. On iPhone, web apps can't read your contacts, so paste the number in.
- **Reminder dates:** open a date column's menu, choose **Edit property**, and tick **Remind me**. Rows then show up under *Due* and in the daily email until one of their checkboxes is ticked. The Tasks **Due** column has this on already.
- **Settings & reminders:** turn the daily email on or off, send yourself a test email, and set the address of your Actual Budget.
- **Backups:** Export and Import (JSON), in the sidebar.

---

## Hosting it on Vercel (about 20 minutes, one time)

You'll create three free accounts: **Supabase** (database and sign-in), **Resend** (email) and **Vercel** (hosting).

### 1. Supabase: database and sign-in

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste in [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates a `user_state` table. Row-level security means each account can only read and write its own data.
3. Go to **Project Settings → API Keys** and note three values:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **publishable** key (older projects call it the **anon** key)
   - a **secret** key (older projects: **service_role**)

   Keep the secret key private. It only goes into Vercel.
4. *(Recommended)* So you can sign in by typing a code (handy for the phone home-screen app), go to **Authentication → Emails → Magic Link** and add this line to the template:
   `Or enter this code: {{ .Token }}`

You'll come back to Supabase after step 3 to set the site URL.

### 2. Resend: the daily email

1. Sign up at [resend.com](https://resend.com) **with the same email address you'll sign in to the app with**.
2. Create an **API key**.

Until you verify your own domain, Resend only delivers mail from `onboarding@resend.dev` to your own account's address. For a personal digest that's all you need.

### 3. Vercel: hosting

1. At [vercel.com](https://vercel.com), choose **Add New → Project** and import this GitHub repo. Framework preset: **Other**. No build command is needed.
2. Add these **Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Project URL from step 1 |
   | `SUPABASE_PUBLISHABLE_KEY` | Publishable (or anon) key |
   | `SUPABASE_SECRET_KEY` | Secret (or service_role) key |
   | `RESEND_API_KEY` | Key from step 2 |
   | `CRON_SECRET` | Any long random string, e.g. the output of `openssl rand -hex 24` |
   | `ALLOWED_EMAILS` | Your email. Digests only go to addresses listed here |
   | `APP_URL` *(optional)* | Your site URL, used for the link in the email |
   | `DIGEST_FROM` *(optional)* | e.g. `Trackers <me@mydomain.com>`, once you've verified a domain in Resend |

3. Click **Deploy**. You'll get a URL like `https://trackers-yourname.vercel.app`.

### 4. Finish up

1. In Supabase, go to **Authentication → URL Configuration**. Set **Site URL** to your Vercel URL and add it under **Redirect URLs**.
2. Open your site, click **☁️ Sign in to sync** in the sidebar, and sign in with the emailed link or code.
   Your trackers upload to your account. Sign in on your phone too.
3. Lock it down: in Supabase **Authentication → Sign In / Providers**, turn off **Allow new users to sign up**. Only your account can use it after that.
4. Open **⚙️ Settings & reminders → Send a test email now** to check that the email works.
5. **On your phone:** open the site, then use Share → **Add to Home Screen** so it opens like an app.

### When the email arrives

The time is set in [`vercel.json`](vercel.json) (`"schedule": "0 13 * * *"` means 13:00 UTC, which is 9am Eastern or 6am Pacific in summer). Change it to suit you. On Vercel's free Hobby plan, cron jobs run once a day and can fire any time within the scheduled hour.

The email is only sent on days when something is overdue, due today or due tomorrow.

### Cost

At the time of writing, all of these are free for personal use:
- **Vercel Hobby:** hosting plus a daily cron job.
- **Supabase free tier:** free projects pause after about a week with no activity. The daily email job reads the database every day, which should keep it active.
- **Resend free tier:** 3,000 emails a month.

The only likely cost is hosting Actual Budget (see below), often a dollar or two a month. Check each provider's current pricing, since plans change.

---

## Finances (Actual Budget)

Finances live in [Actual Budget](https://actualbudget.org), an open-source, privacy-focused budgeting app similar to Monarch. Vercel can't host it, because Actual needs a server that stays running and has its own storage. [`docs/finances-actual-budget.md`](docs/finances-actual-budget.md) compares hosting options, including optional automatic bank sync.

Once it's running, paste its address into **Settings & reminders → Finances**, and a 💰 Finances link appears in the sidebar and on Home.

**Thinking of using an old computer as the server?** Run the checker in [`tools/server-check/`](tools/server-check/README.md) on it first. It tells you whether the machine is fit to run 24/7 and what to fix. Then follow the [home server kit](server/README.md), which covers Ubuntu (optionally alongside Windows, keeping your files) or keeping Windows, plus Tailscale, nightly backups and SimpleFIN bank sync.

---

## Development

```
index.html          page shell
styles.css          styling (light + dark)
core.js             shared logic: dates, due items, email digest (used by browser and API)
app.js              the app: state, rendering, interactions
cloud.js            optional Supabase sign-in + sync
api/config.js       serves the public Supabase settings to the browser
api/digest.js       daily email (Vercel Cron) + "send test email"
supabase/schema.sql database table and security policies
tests/              unit tests (npm test)
```

- **Tests:** `npm test` (Node 18+).
- **Try it locally:** open `index.html` directly, which runs in local-only mode. To test sync locally, run `vercel dev` with the environment variables above.

**How sync works:** each account's trackers are stored as one JSON document. Saves are conditional on the version this device last saw. If two devices edit before syncing, you're asked which copy to keep, so neither is overwritten silently.
