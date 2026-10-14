# Synchro

Make time for your people. A colorful Next.js + TypeScript app with two clearly separated experiences:

- **Live accounts (`/account`)**: real email/Google authentication, email verification, password recovery, persistent preference profiles, Google Calendar consent/disconnection, and live availability on the signed-in person’s primary calendar.
- **Planning demo (`/?demo=1`)**: the complete small-group onboarding → preferences → shared time → activity voting → confirmed plan flow, using sample calendars and participant votes.

Activity recommendations now use eight original vector illustrations bundled with the app. The palette adds lavender, sage, peach, honey, and sky blue while retaining readable dark text. Calendar-file downloads have been removed.

## Run locally

Node.js 20.19+ and npm:

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without credentials, the planning demo runs immediately; `/account` honestly shows that real services are not configured. With account services configured, the welcome screen’s signup/sign-in actions lead to real accounts. `/?demo=1` always opens the independent demo.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

## Enable real accounts and Google Calendar

1. Copy `.env.example` to `.env.local`. It is ignored by Git. Never put service keys or Google secrets in `NEXT_PUBLIC_*` variables.
2. Create a Supabase project. Copy its project URL, publishable (or legacy anon) key, and service-role key into the corresponding variables.
3. Run [the migration](supabase/migrations/202610130001_accounts_calendar.sql) once in the Supabase SQL editor. Profiles have owner-only row-level security. Calendar credentials have no user-facing access policy; only the server’s service-role client can read them.
4. In Supabase Authentication, enable email/password, keep email confirmation enabled, and configure a mail provider for reliable confirmation/recovery delivery. Set the Site URL to `APP_URL`. Add `APP_URL/api/auth/callback` and `APP_URL/api/auth/callback?recovery=1` to allowed redirect URLs. Confirmation and recovery links use PKCE and should be opened in the same browser that requested them.
5. Create a Google Cloud project and enable **Google Calendar API**. Configure the OAuth consent screen, including test users while the app is in testing. Add the `https://www.googleapis.com/auth/calendar.freebusy` scope.
6. Create a **Web application** OAuth client. Add both authorized redirect URIs:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` for Google account sign-in.
   - `http://localhost:3000/api/calendar/callback` for calendar consent (replace the origin with `APP_URL` in production).
7. Enable Google in Supabase Authentication Providers using that Google client ID and secret. Also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` for the separate calendar-connection flow.
8. Generate an encryption key with `openssl rand -hex 32`. Put it in `CALENDAR_TOKEN_ENCRYPTION_KEY`. Keep it stable and backed up; changing it requires existing calendar connections to reconnect.
9. Restart the app. Register an account, confirm the email, save preferences, and connect Google Calendar. Check availability on a date where you know your calendar has a busy event.

`APP_URL` must exactly match the URL used in your browser, including the port. Non-local environments must use HTTPS. Configure equivalent environment variables and redirect URLs on deployment. Do not apply the migration to an unrelated project.

Official setup references: [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Google login through Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), and [Google Calendar free/busy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).

## Live mode behavior

- Email signup/sign-in, Google sign-in, confirmation callback, sign-out, and password recovery are wired to Supabase.
- Auth is handled through same-origin server routes with HttpOnly, SameSite cookies. Session verification uses `getUser()`; no unverified cookie claims are trusted. Session refresh happens inside route handlers, where refreshed cookies can be written. There is no browser Supabase client or session-bearing server component, so this architecture does not need a session-refresh middleware.
- Google account sign-in and calendar consent are separate. Calendar OAuth uses a short-lived state cookie bound to the authenticated user, a PKCE challenge, and fixed configured callback URLs.
- Only `calendar.freebusy` is requested for calendar access. Google refresh tokens are encrypted with AES-256-GCM, stored in a server-only table, and never returned to the browser. Access tokens are refreshed server-side on demand and are not persisted.
- Availability checks read only the primary calendar. Busy blocks stay on the server; the browser receives available windows, not event names or raw calendar contents. Dates use the browser’s IANA time zone, with timezone-aware conversion and daylight-saving tests. Past windows are excluded. Unknown/failed calendar data never becomes “free.”
- Disconnect attempts Google token revocation and deletes the stored connection. If Google is unavailable, the UI explains that the local connection was removed and points to Google permissions for revocation.
- Saved profiles survive refreshes and sign-in on other devices. No demo profile, sample calendar, or participant vote is copied into a live account.

**Live group invitations, other members’ calendar consent, shared group availability, and multi-user votes are not implemented in this phase.** Live mode checks your own calendar. The complete group journey remains explicitly labeled as a separate demo; it never combines real availability with fabricated participants.

## Planning demo walkthrough

1. Finish onboarding and plan a hangout, or open the labeled example.
2. Keep your preferences or customize them for the hangout.
3. Select **Find a shared time**. The app intersects synthetic busy windows for all sample participants.
4. Select a time before recommendations appear.
5. Vote for an illustrated activity. Use **Preview voting as** or **Add sample votes** to explore the other participants’ votes.
6. After everyone votes, confirm the winning activity. Ties can be resolved by choosing a tied leader.
7. Review the plan or reopen voting. No files are downloaded, invitations sent, or calendar events created.

Try **Everyone’s busy** for the no-overlap state. Changing time clears votes; changing hangout preferences restarts scheduling without modifying your saved demo profile. Empty recommendation results offer recovery rather than silently relaxing constraints.

## Readability and motion

Body text and form controls use 16–17 px, with secondary metadata generally 13–14 px. Dark green/plum text remains readable over the richer pastel surfaces. Larger tap targets, visible focus indicators, responsive card layouts, short screen transitions, animated vote progress, and gentle illustration hover effects support the flow. Reduced-motion preferences disable animation and transitions.

## Limits and assumptions

- Demo groups contain 2–10 people including the organizer. Date windows contain at most 14 days inclusive. Durations are 30–480 minutes.
- Live calendar checks use 9 AM–9 PM in the selected device time zone, up to one year ahead, and return the first qualifying window in each free block. Only the primary calendar is included; other calendars must be added in a future phase.
- Activity suggestions use a hand-authored catalog, not AI or venue search. Prices (USD), distances (miles), and category preferences are illustrative. All artwork is original code-native SVG, with no external image requests.
- Demo data stays in memory and resets on refresh. Live profile data persists in Supabase. Demo authentication never creates accounts; live authentication never silently falls back to demo success.
- Google app verification, publishing consent configuration, mail-provider configuration, hosting, and credentials are environment setup tasks. Live OAuth and database acceptance testing requires those services; contract tests with mocked responses do not prove a real provider round-trip.
- Supabase auth rate limits apply to account actions. Before public launch, set appropriate provider quotas, abuse protection, monitoring, and production email delivery. No payments, AI APIs, location APIs, or automatic calendar event creation are included.

## Tests and code map

- `components/synchro-app.tsx`: Demo screens and navigation.
- `components/planning-flow.tsx`: Shared-time demo, recommendation cards, voting, and confirmation.
- `components/activity-scene.tsx`: Eight illustrated activity scenes.
- `components/account-workspace.tsx`: Real-account UI, saved preferences, and live calendar checks.
- `app/api/auth/`: Account API and PKCE callback.
- `app/api/profile/`: Authenticated profile writes.
- `app/api/calendar/`: Consent, callback, revocation, and live availability.
- `lib/server/`: Server-only configuration, session/admin clients, response handling, and authorization.
- `lib/calendar-security.ts`: Authenticated token encryption and state comparison.
- `lib/live-availability.ts`: Time-zone conversion and real busy-block subtraction.
- `lib/planning.ts` and `lib/planning-demo.ts`: Pure demo scheduling/matching/voting logic and fixtures.
- `supabase/migrations/`: Profiles, encrypted connection storage, and RLS permissions.
- `tests/`: Unit tests for validation, preferences, scheduling, votes, encryption, time zones, and malformed provider data. Browser tests cover the demo, layouts, illustrations, accessibility, account UI contracts, unconfigured service behavior, and authorization boundaries.

For a live acceptance check after setup: test signup/confirmation, password recovery, a new Google login, denied calendar consent, accepted consent, known busy times, profile persistence across sign-out, revoked Google access, and disconnect. Verify a second account cannot read the first account’s profile or calendar credentials. These require real configured services and are not represented as completed by local mock tests.
