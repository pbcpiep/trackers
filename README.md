# ✅ My Trackers

A personal, Notion-style workspace for the habits and things you want to keep up with.
It's a plain static web app (HTML + CSS + JS): no build step, no account, no server.

## Getting started

- **Just open it:** double-click `index.html`, or open it in any modern browser.
- **Host it (use it on your phone too):** in the GitHub repo, go to *Settings → Pages*, choose
  *Deploy from a branch*, pick your branch and `/ (root)`. Your trackers will be live at
  `https://<username>.github.io/trackers/`.

Your data is saved in your browser's local storage, which is private to that browser on that device.
Use **Export backup** in the sidebar to download a JSON copy, and **Import backup** to restore it
or move it to another device.

## What's inside

### 🏠 Home
- A **Today** checklist that pulls in every habit from all your habit trackers, with a progress bar
  and 🔥 streaks.
- Cards for every tracker you've set up.

### ✅ Habit trackers
- **Week view:** a check grid for Mon–Sun, a weekly goal per habit (for example, exercise 5 days a week), and
  the current streak. You can step back through past weeks.
- **History view:** a GitHub-style heatmap for the last 20 weeks, plus current streak, best streak,
  30-day completion rate and total check-ins for each habit.
- Click a habit's name to rename it or change its icon, color, weekly goal or position.

### 📚 Database trackers (Notion-style tables)
- **Table view** that you edit inline, with property types: Text, Number, Select, Checkbox, Date,
  Rating (★), and URL.
- **Board view** (kanban) grouped by any Select property. Drag cards between columns.
- Click a column header to edit, sort, group by, move or delete it. Click **＋** to add a column.
- Search, sorting, footer totals (sums for numbers, averages for ratings, done counts for
  checkboxes), and **Open** to edit an entry as a full page.

### Templates
Daily Habits · Reading List · Workouts · Mood Journal · Goals · Spending · an empty habit tracker ·
an empty database.

### Also
- Light and dark mode (it follows your system setting until you pick one).
- Works on phones: the sidebar folds away behind the ☰ button.
- Rename any tracker by clicking its title, and change its icon by clicking the emoji. Use the **⋯** menu
  to duplicate or delete a tracker.

## Files

| File         | What it is                                      |
| ------------ | ----------------------------------------------- |
| `index.html` | Page shell                                      |
| `styles.css` | All styling, including light and dark themes   |
| `app.js`     | State, storage, rendering and interactions      |
