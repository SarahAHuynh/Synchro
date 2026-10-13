# Synchro

A calm, responsive Phase 1 frontend for making time with family and friends. Built with Next.js App Router, TypeScript, React, Tailwind CSS, and Lucide icons. No external accounts or services are contacted by the app.

## Run locally

Use Node.js 20.19+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Start with **Get started**, or use either explicitly labeled demo sign-in option. The Google button uses Alex Morgan as a sample profile.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

For desktop and mobile browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

## Implemented screens

- Welcome, with a CSS calendar illustration.
- Account creation with name, email, password, and password confirmation validation; simulated sign-in.
- Google Calendar connection with not connected, connecting, and demo connected states.
- Three-step preference setup: budget, energy, setting, categories, duration, dislikes, and travel distance; save confirmation.
- Overview with personalized greeting, calendar status, saved preferences, empty state, a labeled example draft, and planning guidance.
- Create a hangout with participant, date, and duration validation.
- Hangout preference confirmation: keep saved preferences or customize a separate copy, then view confirmation.
- Upcoming hangouts and profile screens, plus responsive navigation to every section.

## Simulated features

Accounts, Google sign-up, sign-in, and calendar connections are demonstrations only. Calendar connection uses a short timer. Hangouts and preferences live in React memory for this visit; refreshing resets everything. Passwords are cleared on valid submission and are never persisted or sent anywhere. Invitations are not sent. The example draft is labeled and only enters your list if you confirm its preferences.

The final confirmation marks a hangout ready for the future scheduling stage; no calendars are searched and no activity recommendations are fabricated.

## Deferred to Phase 2

Real authentication and account recovery; Google OAuth and free/busy calendar reads; a database; invitations and participant membership; shared availability computation and time selection; activity recommendations and AI; activity history, likes, votes, and real-time updates; location services; calendar event creation. No payment functionality is included.

The intended order remains: gather preferences → find/select shared time → recommend activities.

## Assumptions

- Groups contain 2–10 people **including the organizer**, so a creator adds 1–9 unique friend emails.
- A date range spans at most 14 calendar days **inclusive** of both dates. Past dates are allowed for this prototype.
- Hangout durations range from 30 to 480 minutes, with minimum no greater than maximum.
- Budget uses US dollars; distance uses miles. Sample preferences start at $25, medium energy, and 10 miles.
- Categories can be empty to represent openness to anything. Dislikes are optional comma-separated values.
- The organizer also acts as a participant in the confirmation flow. Other participants’ preferences are not simulated as received.
- Navigation is local state, as appropriate for this prototype; it does not create browser history entries or deep links. Back buttons retain in-progress form data. Refresh intentionally starts a new session.
- No personal data is written to browser storage or a backend.

## Code map

- `app/`: App Router entry point, metadata, and responsive styling. Tailwind is configured; reusable semantic CSS classes implement the visual system.
- `components/ui.tsx`: Buttons, cards, fields, progress, chips, connection status, summaries, and hangout cards.
- `components/preference-form.tsx`: Controlled reusable preference wizard, shared between permanent and per-hangout editing.
- `components/synchro-app.tsx`: Screen navigation and in-memory prototype state.
- `lib/types.ts`: User, preferences, date range, hangout, and form contracts. Per-participant preference snapshots keep hangout overrides separate from the profile.
- `lib/mock-data.ts`: Sample user, preferences, categories, and example draft.
- `lib/validation.ts`: Pure validation and preference-copy behavior, independent of presentation.
- `tests/`: Unit tests and Playwright flows on desktop and mobile.

Future integrations can replace the in-memory handlers while retaining the typed models and controlled UI components. Calendar permissions, availability windows, recommendations, and votes should be added as dedicated service contracts when those features are implemented.
