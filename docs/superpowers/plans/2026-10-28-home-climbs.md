# Home climbs implementation plan

**Goal:** Integrate the approved two-climb prototype into Home with daily habits.

**Architecture:** Reuse actual habit logs, delegated actions, dialogs, theme tokens and the existing saved/synced settings document. Keep a single manual savings goal (`settings.savingsGoal`: name, targetCents, savedCents); start empty rather than copying sample balances. No bank transfers or real reminder activation. Use the current browser-local day, consistent with existing habit logs.

**Scope:** app.js (normalization, Home, dialog, actions, rollover); styles.css (two-climb layout); README.md (visible behavior); tests/e2e/home-climbs.e2e.js (real Home interactions); tests/e2e/security.e2e.js (untrusted savings data); tests/e2e/sync.e2e.js (goal persistence in mocked cloud sync). No schema, dependencies, email or prototype changes.

## Task 1: Home integration

- [ ] Write and run a failing browser test for daily and savings climbs, check-off/undo, editing a goal, invalid amounts, reload, midnight reset and empty habits.
- [ ] Implement the two-climb Home view, preserving existing habit buttons/links, Due and tracker navigation. The daily climb reads all habit trackers and never changes savings. Savings are entered as dollar balances, stored in integer cents; amounts above the target are valid and visually capped at the summit. Validate names and money before saving and normalize imported/synced goal data.
- [ ] Extend security and mocked sync coverage. Inspect phone/desktop and dark-theme screenshots. Run unit and full browser suites, syntax and whitespace checks; expect no failed or skipped checks.
- [ ] Review the final diff, commit to a separate branch and open a focused PR. Keep existing PRs unchanged.

**Review focus:** Empty/removed habits, stale undo after date rollover or sync, corrupted goal amounts, goal overshoot, cents, unsafe names, keyboard focus and 390px layout. Existing on-page prototype reminder stays separate; real notifications require their own implementation.
