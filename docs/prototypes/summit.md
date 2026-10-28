# Summit engagement prototype

Peyton asked for a visual connection between budgeting, savings goals and habit progress, with an engaging mountain climb, quick check-off and a gentle daily reminder. This is an experimental standalone prototype for review before integrating it into My Trackers.

Open [`../../prototypes/summit.html`](../../prototypes/summit.html) directly in a browser. It has no external dependencies and also works at `/prototypes/summit.html` on a preview deployment.

## Try it

1. **Daily climb:** tap a habit once, or focus it and press Space. The check stays in place and the climber advances. Tap again or use Undo to reverse a mistake. Completing all four reaches today's summit.
2. **Savings climb:** move $25 of sample fun money into Weekend away. The $140 available budget becomes $115, and $1,200 saved becomes $1,225. The savings climber moves independently. Undo restores both values. Habit check-offs never create savings.
3. **Daily reminder preview:** the default is 10:00 p.m. in America/Chicago. Preview shows a gentle message if habits remain. A second preview on the same local date is suppressed, and completing all habits keeps it quiet. Open quick check-in focuses the first unfinished habit without completing it.
4. **Compare directions:** the page also sketches a growing garden and a simple progress ring. Those alternatives are static comparisons; the mountain is the interactive option.

## What is decided and what is provisional

- Peyton chose **two climbs**, with savings advancing only from money saved.
- Peyton answered **“10”** for reminder time. The prototype interprets this as **10 p.m. Central**, because the discussion concerned an evening check-in. The time is editable; AM/PM should be confirmed before a real reminder is enabled.
- The daily summit resets on the next Chicago local date; savings carry on. A longer weekly or lifetime habit journey is an open design choice, not an agreed requirement.
- A sample money move demonstrates a budget allocation to savings. It does not initiate a bank transfer, import Monarch data, or record a real financial transaction.

## Data and state

The fixed sample budget is $200, with $60 already spent and $140 available to move. The sample goal is $3,000 with $1,200 saved initially. Money uses integer cents. Available funds cannot become negative.

Demo state is stored only under `trackers:summit-prototype:v1`, separately from `trackers:v1`. Check-offs are for the current America/Chicago local date, with a rollover check on visibility and once a minute while open. Sample transfers and reminder-preview preferences persist across reloads. Reset demo resets only this prototype's sample state. It neither reads nor modifies synced or real tracker data.

The reminder is **on-page simulation only**. It requests no notification permission, registers no push subscription, and sends no email, push or vibration. A real implementation needs the install/permission/server work in [notification feasibility](notification-feasibility.md). The once-per-day state illustrates a delivery rule; it is not a production scheduler or cross-device delivery guarantee.

## Visual direction

The original mountain illustration uses quiet alpine blue (`#d9eaf4`), slate (`#233d51`), pine (`#256b61`), snow (`#f8fcff`) and a sunlit trail (`#f0b460`). A Georgia headline gives the landscape some warmth; native system text keeps the actions familiar and readable offline. Large full-row habit buttons carry the main action. Motion follows a tap and respects reduced-motion settings.

The design keeps the playful metaphor beside explicit counts and dollar amounts, rather than replacing them. See [visualization research](goal-visualizations.md) for primary references and alternatives; no behavior-change outcome is promised.

## Validation

The prototype browser test covers one-tap and keyboard check-off, focus, undo, separate money/habit progress, cents, overspending rejection, empty budget, persistence and invalid saved values, reminder preference changes, once-per-day and all-done suppression, midnight reset, and no external requests. Check at 390px and desktop, including the full existing unit/browser suites before pushing. A physical iPhone and actual notification delivery still need separate testing.

## Morning decisions

1. Does a daily summit feel satisfying, or should habits build a longer weekly trail?
2. Confirm 10 p.m. Central and whether the reminder should remain quiet once all chosen habits are done.
3. Choose whether to integrate the prototype into Home, keep refining the visual, or try the garden/ring direction first. Real finance connections and push notifications are separate implementation steps.
