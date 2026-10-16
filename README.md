# Synchro

Make time for your people. Synchro helps groups of 2–10 people find shared free time and choose an activity.

The original prototype design is now the actual application: the same left sidebar, dashboard, preference form, illustrated activity cards, and planning layout use real accounts and persisted data. There is no separate demo route, fake sign-in, sample participant voting, or simulated calendar connection in the UI.

## Run locally

Node.js 20.19+ and npm:

```sh
npm install
npm run dev
```

Open http://localhost:3000. Real accounts require the setup below; missing configuration shows an honest unavailable message rather than simulated success.

```sh
npm run check:setup
npm run lint
npm run typecheck
npm test
npm run build
```

`check:setup` only checks environment configuration, provider settings, required table columns, and anonymous access restrictions. It does not print secrets or retrieve account records. Use `npm run check:setup -- --offline` for local configuration checks only.

## Screens

| URL | Screen |
| --- | --- |
| `/` | Original welcome screen, with real signup/sign-in actions |
| `/account` | Overview: original dashboard, compact preference/calendar cards, next hangout |
| `/account/plan` | Create a hangout; optional email chips and a shareable invitation link |
| `/account/hangouts` | Saved hangouts and invitations |
| `/account/hangouts?hangout=<id>` | One hangout’s shared times, voting, and confirmed plan |
| `/account/preferences` | Personal preference form |
| `/account/calendar` | Calendar connection and personal availability |
| `/account/profile` | Account details and sign-out |
| `/hangouts/<id>?invite=<token>` | Shareable invitation; returns recipients to the hangout after signup/setup |

The sidebar navigates between these pages. Mobile uses the same sidebar behind a menu button. Home does not stack every detailed form. Hangout customization and management open focused views only when requested.

## Supabase and Google setup

1. Copy `.env.example` to `.env.local` if it does not already exist. This file is ignored by Git. Keep existing encryption keys when updating credentials.
2. Create a Supabase project. In **Connect** / **Settings → API Keys**, copy the project URL and publishable key into `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Put the server secret (`sb_secret_…`) or legacy service-role key into `SUPABASE_SERVICE_ROLE_KEY`. Do not prefix server secrets with `NEXT_PUBLIC_`.
3. Run these SQL migrations in order in Supabase’s SQL Editor. Apply any migrations not already installed:
   - [Accounts and calendars](supabase/migrations/202610130001_accounts_calendar.sql)
   - [Group planning](supabase/migrations/202610140001_group_planning.sql)
   - [Calendar events](supabase/migrations/202610150001_calendar_events.sql)
   - [Attendance notifications](supabase/migrations/202610150002_attendance_notifications.sql)
4. In Supabase Authentication, enable email/password and keep email confirmation enabled. Set Site URL to `APP_URL`. Add `APP_URL/api/auth/callback` and `APP_URL/api/auth/callback?recovery=1` to the allowed redirects. Configure custom SMTP for email confirmations/recovery for public users; the default Supabase mail service is limited to pre-authorized recipients. PKCE email links should be opened in the browser that requested them.
5. In Google Cloud, enable **Google Calendar API**. Configure Google Auth Platform branding and External audience, and add your Google accounts as test users while the consent app is in Testing. Include `openid`, `userinfo.email`, `userinfo.profile`, `https://www.googleapis.com/auth/calendar.freebusy`, and `https://www.googleapis.com/auth/calendar.events.owned` in the consent scope configuration.
6. Create a Web application OAuth client. Add `http://localhost:3000` as a JavaScript origin and these redirect URIs:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` for account sign-in.
   - `http://localhost:3000/api/calendar/callback` for calendar access.
7. Enable Google in Supabase Authentication Providers with the client ID and secret. Put the same values into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
8. If no encryption key exists yet, generate one with `openssl rand -hex 32`, then set `CALENDAR_TOKEN_ENCRYPTION_KEY`. Keep it stable: changing it requires calendars to reconnect and invalidates existing shareable links.
9. Set `APP_URL=http://localhost:3000`, restart the app, and run `npm run check:setup`.

`APP_URL` must exactly match the browser origin, including its port, without a trailing slash. Use HTTPS outside localhost.

Official references: [Supabase keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google consent configuration](https://developers.google.com/workspace/guides/configure-oauth-consent), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), and [Calendar free/busy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).

## Invitation and planning flow

1. The organizer signs in, saves preferences, and connects Google Calendar.
2. Create a hangout. Guest emails are optional: add one email at a time and press **Add** to turn it into a removable chip. Duplicates, your own email, and malformed addresses are rejected. You can also create the plan without any guest emails and invite entirely by link.
3. Click **Copy invitation link** and text it to your friends. “Link copied” appears beside that button. The app does not send texts or emails automatically.
4. Anyone with the signed link can sign in or create an account, save preferences, connect a calendar, and accept the invitation. The invitation is retained in same-origin browser storage for up to seven days to resume across signup and OAuth redirects. A new tab in the same browser can resume it. Joining still requires a verified email, a calendar connection, and explicit consent for that hangout’s dates.
5. Optional named email invitations also appear in those users’ hangout lists. Existing accepted members can open their hangout without its invitation token.
6. Once at least two people have joined and all listed guests are ready, the organizer finds and selects a real shared time. Illustrated activity suggestions appear only after the time is selected.
7. Each person casts their own vote. After everyone votes, the organizer confirms a leading activity, choosing among ties if necessary. Calendars are checked again before confirmation. The result is saved for everyone and Google Calendar event creation is queued for each joined participant.

New participants joining an already-open vote reset its selected time and votes so the enlarged group is rescheduled fairly. Confirmed plans must be reopened before new people join. A pending named guest occupies one of the ten group places. The organizer can remove a pending invitation to free a place.

**Customize for this hangout** opens the existing preference form immediately in a focused view. It only updates that hangout’s snapshot; personal preferences are unchanged. **Manage hangout** holds dates, guests, and cancellation controls. Changing dates requires everyone’s consent again. New members and preference changes invalidate prior time selections and votes. Removing a guest preserves the plan when at least two people remain; otherwise it reopens planning.

Anyone holding a shareable link may forward it. Organizers can replace it through **Manage hangout → Replace invite link**. Removing a guest also replaces the link to prevent rejoining with that old link. Other members do not receive the organizer’s shareable URL. Bearer links reveal only minimal invitation information before joining, not group members’ data.

## Calendar access and storage

- Google account sign-in and Calendar consent are separate. Calendar access requests `calendar.freebusy` and `calendar.events.owned`. Existing users must reconnect to grant the additional permission.
- Supabase auth is handled in same-origin route handlers with HttpOnly, SameSite cookies and `getUser()` verification. Cookie refresh happens in route handlers; no browser Supabase client is used.
- Calendar consent uses PKCE, state bound to the signed-in user, and fixed callback URLs. Refresh tokens are encrypted with AES-256-GCM in a server-only table. Existing personal event titles, descriptions, guests, raw busy blocks, and tokens are never sent to the browser. Synchro creates only its own confirmed-hangout events and looks up those known event IDs when checking retries.
- Scheduling compares the union of participants’ busy blocks on their primary calendars. Times use the hangout’s IANA time zone with daylight-saving support. Failed, missing, or revoked calendar access is never assumed to be free.
- Profiles use owner-only row-level security. `calendar_connections` and `hangout_groups` have no user-role access grants. Server routes verify member/organizer permissions before service-role access.
- Shareable invitations use HMAC-SHA256 with a separate purpose string, hangout ID, and replaceable version. The signing key stays server-only; tokens are compared in constant time. No new database table or public account directory is used.
- Group writes compare a saved revision to prevent concurrent edits/votes from overwriting each other. Participants see their own vote confirmation without activity totals or other people’s choices. Once everyone votes, only the organizer receives the eligible winning activity IDs for confirmation.
- Updates poll every 15 seconds while the tab is visible, with a manual refresh control. The list shows the 100 most recent plans/invitations.

## Public hosting

Use a Next.js-compatible host such as Vercel. Keep `.env.local` out of Git; configure the same variable names in the hosting dashboard. Set the deployed `APP_URL` to your stable HTTPS address, update Supabase Site URL/allowed redirects, and add the public calendar callback to Google. Keep local and public settings consistent with their respective origins.

Links containing `localhost` only work on the machine running the app. A public URL is required to text invitations to people on other devices. Before opening signups broadly, finish Google consent publishing/required verification and production email delivery.

## Limits

- Groups: 2–10 people for scheduling; creation may start with just the organizer.
- Date windows: up to 14 days inclusive, starting today through the next year. Shared times: 9 AM–9 PM in the hangout time zone, durations 30–480 minutes.
- Activity suggestions use a curated catalog, with estimated USD costs/distances, not AI or searched venues.
- No calendar downloads, text/email sending, account-directory search, reminders, payments, or live location search.
- Synthetic calendar fixtures remain only for pure algorithm tests; product screens never use them.

## Validation

```sh
npx playwright install chromium
npm run test:e2e
```

Browser tests use an isolated server on port 3100 with `.next-test` build output and no live service credentials. They cover the original welcome/sidebar design, mobile layouts, email chips, copy feedback, focused customization, signup-to-invitation continuity, scheduling/voting, and connection recovery. Server-route tests cover access control, link verification/replacement, group capacity, concurrency, consent, and calendar failures.

Mock tests do not prove a real OAuth round-trip. For live acceptance, use two accounts in separate browser profiles: sign in, connect each calendar, create a hangout, share its link, join, check a known busy date, vote, confirm, and refresh both accounts. Also verify a non-member without the link cannot open it, and an old replaced link cannot admit a new account.

## Code map

- `components/synchro-app.tsx`: Original welcome design with real entry actions.
- `components/account-shell.tsx` and `navigation.tsx`: Shared sidebar and responsive app shell.
- `components/account-home.tsx`, `group-card.tsx`, and `ui.tsx`: Original dashboard/card components using persisted data.
- `components/account-workspace.tsx`: Authentication and separate account pages.
- `components/group-workspace.tsx`: Hangout creation, invitations, and focused editing.
- `components/planning-flow.tsx`: Original planning layout connected to real scheduling/votes.
- `components/guest-emails.tsx`: Email input, validation, and removable guest chips.
- `lib/server/groups.ts`, `calendar.ts`, and `invitations.ts`: Authorized storage, real calendar access, and invitation signing.
- `app/api/`: Auth, profile, calendar, and hangout routes.
- `supabase/migrations/`: Tables and access controls.

## Automatic Google Calendar events

After everyone votes, the organizer confirms a winning activity. This queues one event on each joined participant’s **primary Google calendar**, using the confirmed time and activity. These are individual event copies, not emailed attendee invitations. A tie still needs the organizer’s choice. Older confirmed plans have an **Add to Google calendars** button; they are not silently backfilled.

### Enable on your existing project

1. Open `supabase/migrations/202610150001_calendar_events.sql`, copy its entire contents, and run it in your Supabase dashboard’s **SQL Editor → New query**. It must follow the existing accounts and group-planning migrations. This adds a private queue, its worker functions, and a trigger; it does not delete your hangouts. Run the entire file, including `begin` and `commit`.
2. In your existing Google Cloud project, go to **Google Auth Platform → Data Access → Add or remove scopes**. Keep `https://www.googleapis.com/auth/calendar.freebusy`, and add `https://www.googleapis.com/auth/calendar.events.owned`. Save. Google’s permission wording includes viewing/editing owned-calendar events, although Synchro operates only on its own created events and free/busy availability.
3. Keep **Google Calendar API** enabled. Keep your current client ID, client secret, and redirect URL (`http://localhost:3000/api/calendar/callback` for the default local setup). No new credential values are needed in `.env.local` for immediate event creation.
4. If the consent app is in Testing, add every participant’s **Google account** under **Audience → Test users**. Every existing Synchro participant must open **My calendar → Reconnect Google Calendar** and grant both calendar permissions. A plain Google sign-in does not grant Calendar permissions.
5. Restart `npm run dev`. Run `npm run check:setup` to verify that the queue table is reachable. Create a future hangout with two accounts, join, choose a time, vote, and confirm the winning activity. The confirmed screen should show **2 of 2 calendars updated**. Check each connected Google account’s primary calendar. Test reopening/cancelling as well: its event copies should be removed.
6. If a participant needs to reconnect or Google fails temporarily, their work stays queued. Reconnect, return to the hangout, and click **Retry calendar sync**. A user who disconnects must reconnect before Synchro can remove any event it previously created; they can also delete that event manually.

### Background retries when deployed

Immediate creation/removal runs as part of the hangout action; it does not require a cron service. To retry failures while nobody has the app open, configure a scheduler after deployment:

- Generate a separate secret with `openssl rand -hex 32` and add it as the server environment variable `CRON_SECRET`. Do not put it in a `NEXT_PUBLIC_` variable or a public URL.
- Schedule a GET request to `https://YOUR-DOMAIN/api/calendar/sync` every five minutes, with header `Authorization: Bearer YOUR_CRON_SECRET`. Use a hosting scheduler that supports authenticated requests and your required interval. Each request processes up to ten due jobs; increase frequency for larger backlogs.
- The endpoint rejects missing/incorrect secrets. No background scheduler is installed by this repository. Localhost needs to be running for local actions/retries; a cloud scheduler cannot reach it.
- Google Testing-mode calendar tokens normally expire after seven days. Before a public launch, complete the production OAuth/verification setup, register the public callback URL, set `APP_URL`, and reconnect accounts as necessary.

### Reliability and boundaries

The database trigger creates/removes jobs in the same transaction as the plan update. Workers lease jobs, store partial failures, and use deterministic Google event IDs to avoid duplicates after timeouts. Cancellation during creation leaves a deletion pending; reopening and reconfirming uses fresh IDs. Failed jobs retry after five minutes or on explicit retry. Only server-side service-role requests can access this queue.

No Google events are created merely by opening a page or joining a group. Calendar updates start on organizer confirmation. Changes made directly in Google Calendar are not synchronized back into Synchro; manually deleted confirmed events are not automatically recreated. Do not delete hangout rows directly in the database—use Cancel in the app so calendar cleanup is queued.

References: [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), and [Google OAuth testing limitations](https://developers.google.com/identity/protocols/oauth2/).

## Cancelling a hangout

Organizers can use the trash button on a hangout card to cancel it for everyone. The centered confirmation requires a reason and explains the shared effect and Google Calendar cleanup. Participants see the cancellation reason. The record remains visible with a Cancelled status. Participants receive an in-app cancellation notice on their next visit or refresh (open account pages check every 15 seconds). Dismissing a notice is remembered in that browser for that account; the cancelled record remains accessible. No email or text notification is sent. Cancellation uses the existing calendar queue to remove Synchro-created event copies.


## Attendance changes and attention notices

Run the entire `supabase/migrations/202610150002_attendance_notifications.sql` file in Supabase SQL Editor, including `begin` and `commit`. This adds private notifications for removed participants. Existing hangouts are preserved. Attendance requests and removals report a setup error until this migration is installed.

Guests use **I can’t make it** beneath Hangout details to request removal or rescheduling, with a required reason. The organizer sees an attention banner and reviews the request, choosing to reopen scheduling, remove the guest, or keep the current plan. Each decision requires an explanation. The requester can see the response; other guests cannot see private attendance reasons. Removing a guest preserves a confirmed plan when at least two people remain and queues removal of only that guest’s Google event. Reopening scheduling clears the selected time and votes and queues cleanup of existing event copies.

Overview cards and top banners indicate invitations, voting, choosing a time, final confirmation, and attendance reviews. Notices are in-app only. Dismissals are saved per account in the current browser. Removed participants retain a private notice with the organizer’s reason even though they can no longer open the hangout.

**Save dates** saves the proposed date range and duration, clears the selected time and votes, and requires everyone to confirm availability again. It does not add an event to Google Calendar; organizer confirmation does that.

## Verification email troubleshooting

In Supabase, open **Authentication → Email → SMTP Settings**. If custom SMTP is off, the default email service sends only to project-team addresses. Configure a verified sender through custom SMTP for other users; SMTP settings belong in Supabase, not `.env.local`. Check spam and Supabase Auth logs for delivery errors. The app offers **Resend verification email** with a cooldown and reports provider restrictions/rate limits. A successful resend request does not prove delivery. Open the verification link in the browser used to sign up.

See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
