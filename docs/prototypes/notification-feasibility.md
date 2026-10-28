# Habit reminder feasibility

Research for the prototype, 27 October 2026. Peyton chose “10”; **10:00 p.m. America/Chicago is a provisional interpretation**, pending confirmation; no reminder or permission has been enabled.

## What is possible

- iPhone/iPad Web Push is supported for a Home Screen web app on iOS/iPadOS 16.4 or later. The app needs HTTPS, an installed Home Screen app, a service worker and Push/Notifications APIs. Permission must be requested after a direct tap. Notifications respect the person's iOS notification and Focus settings. An Apple Developer Program membership is not required. [WebKit: Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- The site cannot rely on a page timer to send a daily notification after the browser is closed; a service worker alone is not a dependable alarm clock either. A server or other reliable scheduler must trigger a push, which wakes the worker. Periodic background sync is browser-controlled and not a precise daily alarm. [WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/), [Chrome: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- Decide whether to send **before** the push: WebKit requires a received push to result in a visible notification. Trying to use silent pushes to check whether habits are done can cause the subscription to be revoked. [WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)
- For checkoff feedback, favor a visible check, progress change and optional reduced-motion animation. MDN's current compatibility data lists `navigator.vibrate()` as unsupported in Safari/iOS; do not promise an iPhone haptic. Feature-detect it on devices that support it, and verify on real hardware. Notification sound/vibration is separately governed by device settings. [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json), [WebKit: iOS notifications](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## What the app already has

- Home already shows today's habits and lets the user toggle each one. Completion is stored under `tracker.log[habitId][YYYY-MM-DD]` (`app.js`); `cloud.js` can sync the whole state document to Supabase, but local-only and offline changes need not be on the server.
- The app has no manifest, service worker or Web Push subscription. Its existing `vercel.json` calls `/api/digest` at **13:00 UTC**. The digest emails overdue/upcoming items, only when something is due; habits are listed in a digest that otherwise qualifies, but incomplete habits alone do not trigger it. It is not an evening habit push.
- The browser's time zone is assigned during `normalize()` and can be overwritten when another device loads the app. A future reminder needs its own explicit IANA time zone and a consistent date key shared by logging and scheduling.

## Small future implementation

1. Keep the prototype clearly labeled **preview**: its time and reminder state illustrate the experience, with no real permission request, schedule, or alert. The proposed 10 p.m. Central time is a provisional interpretation of Peyton's “10,” pending confirmation.
2. If the user later opts in to real reminders, provide a Home Screen installation path, a standalone manifest and service worker, then request notification permission only when they tap an enable button. Store that device's push subscription through an authenticated, owner-scoped endpoint; keep signing keys server-side and remove invalid subscriptions. Respect denial, unsubscribe and sign-out.
3. Schedule a protected server function to inspect the latest synced state in the reminder's IANA time zone. Count configured habits for that local date; send one generic, kind reminder only when at least one remains incomplete. Do nothing when there are no habits, all are complete, the reminder is off, or state/subscription is unavailable. Use an atomic unique claim per user and local date, and one chosen device if “once per day” means one notification across devices. Cron can occasionally duplicate or miss invocations, so a claim should favor skipping an uncertain retry over duplicate alerts. [Vercel: delivery and idempotency](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
4. Use a short Web Push TTL to reduce stale alerts after connectivity returns; this trades delivery reliability for quietness. Completion marked offline, or immediately after the server check, can still produce a stale reminder: the server cannot see unsynced work and iOS requires the push to be visible. Do not claim perfect suppression. [HTTP Web Push TTL](https://www.rfc-editor.org/rfc/rfc8030.html#section-5.2)
5. Store the chosen local time and `America/Chicago` (or the user's selected IANA zone), not a fixed UTC offset. For example, 10 p.m. Central is 03:00 UTC the next day in daylight time and 04:00 UTC in standard time. For configurable times, define how to handle a nonexistent spring time and use one occurrence for a repeated fall time; test those transitions and travel/cross-device date boundaries.

## Scheduling tradeoff

Vercel schedules use UTC. Its Hobby plan allows 100 cron jobs per project, each no more than once daily, and may invoke a job anywhere in its scheduled hour; plan status has not been checked. [Vercel cron](https://vercel.com/docs/cron-jobs), [Vercel limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

For the provisional **10–11 p.m. Central window only**, a possible Hobby implementation is two separate daily schedules, 03:00 and 04:00 UTC, calling the same endpoint; check that the local hour is 22 and skip the other invocation, with the same per-day claim. This remains approximate, can miss a run, and is not a general configurable-minute scheduler. A time-zone-aware scheduler or a more frequent paid-plan job is needed for more precise, user-adjustable times; choose only after the preference and hosting plan are known.

Not checked: actual iPhone behavior, notification permissions, account configuration or live scheduler delivery. No account, app, or notification settings were changed.
