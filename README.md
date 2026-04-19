# Birthday App (Vercel + Supabase)

Dashboard + scheduled birthday email sender for SFGS.

## What it does

- Reads today's birthdays from the portal API (`portal.sfgs.com.ng/?page=birthdays_api`)
- Sends birthday wishes to parent emails via Brevo
- Logs sends (success/fail) and shows them in a dashboard

## Setup checklist

1. Portal env: set `BIRTHDAY_API_TOKEN` (same value used in Supabase function).
2. Supabase: run `birthday-app/supabase/schema.sql` in the SQL editor.
3. Supabase secrets (Edge Function):
   - `PORTAL_BIRTHDAYS_API_URL`
   - `PORTAL_BIRTHDAYS_API_TOKEN`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
4. Deploy edge function `birthday-sender` and schedule it.
5. Deploy the dashboard to Vercel and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

