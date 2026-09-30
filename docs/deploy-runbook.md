# Deploy runbook (for an agent or a person)

This runbook takes the app from "code in GitHub" to live on Vercel, with Supabase sync and the daily email. It can be done by clicking through the dashboards (see the README, "Hosting it on Vercel") or entirely through APIs, as below.

The API calls are written from the providers' public docs. **Check each against the current docs if a call is rejected**, since these APIs change.

## Prerequisites (the owner does these)

1. **Create accounts:**
   - [Vercel](https://vercel.com/signup): sign up **with GitHub**, and give the Vercel GitHub app access to `pbcpiep/trackers`.
   - [Supabase](https://supabase.com/dashboard/sign-up).
   - [Resend](https://resend.com/signup): use the same email the owner will sign in to the app with.
2. **Create tokens and store them as environment variables in the agent's environment.** Never paste them into chat.
   - `VERCEL_TOKEN`: https://vercel.com/account/tokens
   - `SUPABASE_ACCESS_TOKEN`: https://supabase.com/dashboard/account/tokens
   - `RESEND_API_KEY`: https://resend.com/api-keys (full access)
3. **Allow the agent's network to reach** `api.vercel.com`, `api.supabase.com`, `*.supabase.co` and `api.resend.com`.
4. **Afterwards:** delete the Vercel and Supabase tokens. The Resend key is still needed by the app, as the `RESEND_API_KEY` Vercel env var.

## 1. Supabase project

```bash
H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")
ORG=$(curl -s "${H[@]}" https://api.supabase.com/v1/organizations | jq -r '.[0].id')
DBPASS=$(openssl rand -base64 24)   # not needed afterwards; the app never connects directly
REF=$(curl -s "${H[@]}" -X POST https://api.supabase.com/v1/projects \
  -d "{\"name\":\"trackers\",\"organization_id\":\"$ORG\",\"region\":\"us-east-1\",\"db_pass\":\"$DBPASS\"}" | jq -r .id)
# wait until ready
until [ "$(curl -s "${H[@]}" https://api.supabase.com/v1/projects/$REF | jq -r .status)" = ACTIVE_HEALTHY ]; do sleep 10; done
# schema
jq -Rs '{query: .}' supabase/schema.sql | curl -s "${H[@]}" -X POST https://api.supabase.com/v1/projects/$REF/database/query -d @-
# keys (publishable/anon + secret/service_role)
curl -s "${H[@]}" "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true"
```

Record the following (do not print the secret key in logs that the owner sees):
- `SUPABASE_URL=https://$REF.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: the publishable key, or the legacy `anon` key
- `SUPABASE_SECRET_KEY`: a secret key, or the legacy `service_role` key

## 2. Vercel project, env vars and deploy

```bash
V=(-H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json")
curl -s "${V[@]}" -X POST https://api.vercel.com/v10/projects \
  -d '{"name":"trackers","framework":null,"gitRepository":{"type":"github","repo":"pbcpiep/trackers"}}'
CRON_SECRET=$(openssl rand -hex 24)
APP_URL=https://trackers.vercel.app   # or the project's actual production domain
# Add each variable (target production + preview):
#   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, RESEND_API_KEY,
#   CRON_SECRET, ALLOWED_EMAILS=<owner email>, APP_URL
curl -s "${V[@]}" -X POST "https://api.vercel.com/v10/projects/trackers/env?upsert=true" \
  -d "[{\"key\":\"CRON_SECRET\",\"value\":\"$CRON_SECRET\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\"]}, ...]"
# Deploy the default branch
curl -s "${V[@]}" -X POST https://api.vercel.com/v13/deployments \
  -d '{"name":"trackers","project":"trackers","target":"production","gitSource":{"type":"github","org":"pbcpiep","repo":"trackers","ref":"<default branch>"}}'
```

Check the result: `curl https://<domain>/api/config` should return the Supabase URL and key.

## 3. Supabase auth settings

```bash
curl -s "${H[@]}" -X PATCH https://api.supabase.com/v1/projects/$REF/config/auth -d "{
  \"site_url\": \"$APP_URL\",
  \"uri_allow_list\": \"$APP_URL/**\",
  \"mailer_templates_magic_link_content\": \"<h2>Sign in to My Trackers</h2><p><a href=\\\"{{ .ConfirmationURL }}\\\">Sign in</a></p><p>Or enter this code: <b>{{ .Token }}</b></p>\"
}"
```

## 4. Hand-off to the owner

1. The owner opens the app, clicks **☁️ Sign in to sync**, and signs in with their email.
2. **Then** close sign-ups:
   ```bash
   curl -s "${H[@]}" -X PATCH https://api.supabase.com/v1/projects/$REF/config/auth -d '{"disable_signup": true}'
   ```
3. The owner opens **Settings & reminders → Send a test email now**.
4. The owner deletes the Vercel and Supabase access tokens.
