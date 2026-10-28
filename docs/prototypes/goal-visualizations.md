# Goal visualization research

Checked October 27, 2026. These are product-design references, not evidence that any pattern changes behavior. The prototype should use only sample data and must label it as such.

## Three patterns

| Pattern | What the official product does | Fit for My Trackers |
| --- | --- | --- |
| **Mountain path with checkpoints** | LiftDay shows a nine-stage mountain climb, with one-tap check-ins and named stages. Its weekly target allows flexible schedules. Duolingo’s official redesign describes a step-by-step path of circle-shaped levels grouped into units. [LiftDay: The Climb](https://www.getliftday.app/), [Duolingo: The Science Behind the Home Screen Redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/) | **Best fit.** It makes habit checkoffs visible as movement and gives the owner a clear next checkpoint. Use a few labeled stops, not a long game system. Borrow the one-tap action; don’t copy streak reset rules. |
| **Grow a companion or collection** | Finch turns goal checkoffs into energy for a virtual bird’s adventure; the bird returns with a story and may discover something new. Forest turns a completed focus session into a tree that stays in the user’s visible forest. [Finch: About Finch](https://finchcare.com/about-finch), [Finch Help: Going on an Adventure](https://help.finchcare.com/hc/en-us/articles/37779979512845-Going-on-an-Adventure), [Forest](https://www.forestapp.cc/) | Warm and charming, but more character/collection content than this first prototype needs. It is a reasonable alternate if Peyton prefers a companion over a landscape. |
| **Straight savings progress** | YNAB targets represent amounts to save, spend, or set aside; its progress bars show target status across categories, with a donut/detail view for one selected category. [YNAB: How to Use Targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks), [YNAB: Visual Progress Bars](https://support.ynab.com/en_us/progress-bars-a-guide-SkDEhot09) | **Best for money truth.** A labeled amount and progress bar are immediately legible, but by itself it does little to make habit checkoffs feel like a journey. |

## Recommendation

Use the **mountain path as the main visual** and place a small, separate savings card beside or below it. For example:

- **Habit climb:** “4 of 12 checkoffs to Base Camp.” A large **Done** control on each due habit advances the climber/checkpoint immediately. A missed day pauses the path; it does not take previously earned steps away.
- **Savings goal (sample data):** “Emergency fund: $1,200 of $3,000 · 40%.” Keep the amount, remaining dollars, and progress bar tied only to the sample balance.
- Make the two measures visibly different and explicitly label them **habit checkoffs** and **sample dollars**. A habit checkoff can move the climber; it never adds money, earns cash, or changes the savings percentage.

The prototype succeeds if, on a phone-width screen, Peyton can tap **Done** once, see that habit marked complete and the climb update without a dialog, and separately read the savings amount and goal. Repeated taps should have an obvious state (completed/undo); the money values should stay unchanged when habits are checked off. Show a visible “Sample data” label and omit bank links, account connections, and any promise that the visual will improve consistency.

## Source notes

- LiftDay’s first-party site describes the mountain as nine stages, says each check-in moves progress, and documents a one-tap interaction and flexible weekly target. Its own streak still resets if the weekly target is missed; the prototype recommendation above deliberately uses non-decreasing earned steps instead.
- Duolingo’s first-party blog describes its linear learning path as step-by-step circles grouped into units. This supports the checkpoint layout, not any claim about habit outcomes.
- Finch’s first-party page and help article describe goal checkoffs earning energy and enabling an adventure. Forest’s first-party page describes a completed session joining a visible forest. These support the growth/collection alternative only.
- YNAB’s first-party help pages describe target progress bars and a more detailed target view. This is a money-display reference; the prototype has no connection to YNAB or live accounts.
