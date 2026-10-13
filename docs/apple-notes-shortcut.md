# Apple Notes → My Trackers

Apple doesn't let websites read Apple Notes, so a small **iPhone Shortcut** does the sending. It uploads the notes in the folders you choose (set up for **bills** and **shop/lists**) to your own Supabase database. The app shows them on the **📝 Notes** page.

- **Only those folders leave your phone.** Nothing else in Apple Notes is read.
- **Notes are read-only in the app.** Edit them in Apple Notes, and the next sync updates the app.
- **Each sync replaces that folder's copy.** Deleting a note in Apple Notes removes it from the app at the next sync.
- **Shopping:** on a shop/lists note, **🛒 Add lines to Shopping List** turns each line ("- Milk", "• Eggs", "[ ] Paper towels") into an item, skipping ones already on your list.

## Set up (once, about 5 minutes)

The app walks you through this with the values filled in: **Settings & reminders → Apple Notes → Set up Apple Notes sync**.

1. **Create your Notes key** in that screen and copy it. It's shown only once. Making a new one turns off the old one.
2. **Build the Shortcut:** open the **Shortcuts** app → **＋** and name it *Sync Notes to Trackers*.
   1. **Find Notes**, filtered to: **Folder** is **bills**.
   2. **Repeat with Each** over those notes. Inside it:
      - Add a **Dictionary** with three Text fields:
        - `title` = *Repeat Item → Name*
        - `body` = *Repeat Item → Body*
        - `modified` = *Repeat Item → Last Modified Date* (set its date format to **ISO 8601**)
      - Add **Add to Variable** → `notes`
   3. **Get Contents of URL**:
      - URL: the upload address shown in the app (`https://<project>.supabase.co/rest/v1/rpc/import_notes`)
      - Method: **POST**
      - Headers: `apikey` = the public key shown in the app, and `Content-Type` = `application/json`
      - Request Body: **JSON**, with three Text fields:
        - `p_key` = your Notes key
        - `p_folder` = `bills`
        - `p_notes` = the `notes` variable
   4. **Set Variable** `notes` to nothing. Then duplicate steps 1–3 for **shop/lists**: change the folder filter and `p_folder`.
3. **Run it once**, then tap **↻ Refresh** on the Notes page.
4. **Make it automatic:** Shortcuts → **Automation** → **＋** → **App** → *Notes* → **Is Closed** → **Run Immediately** → *Sync Notes to Trackers*.

## Troubleshooting

- **`unauthorized`:** the key in the Shortcut doesn't match. Create a new key in the app and paste it into the Shortcut again.
- **Nothing shows up:** check that the folder names in the Shortcut match Apple Notes exactly (`bills`, `shop/lists`), then tap **↻ Refresh**.
- **Dates missing:** set the Last Modified Date format to ISO 8601 in the Dictionary step. Notes still sync without dates.

## How it works (for agents)

- The schema is in [`supabase/notes.sql`](../supabase/notes.sql):
  - `public.notes` is readable only by its owner (row-level security).
  - `private.note_keys` stores only a SHA-256 hash of each key.
- `set_notes_key(p_key)` is called by the signed-in app (`Cloud.createNotesKey`).
- `import_notes(p_key, p_folder, p_notes)` is called by the Shortcut with the publishable key. It accepts a JSON array, a single object, or text with one JSON object per line (what Shortcuts produces when a list of dictionaries goes into a Text field).
