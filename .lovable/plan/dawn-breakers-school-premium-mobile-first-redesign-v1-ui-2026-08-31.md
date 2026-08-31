# Dawn Breakers School — Premium Mobile-First Redesign (V1 UI)

A full visual redesign of the existing PWA plus the missing parent/teacher screens, built on the current auth, routing, database and import logic — no backend changes.

Note: only the logo and the gate photograph came through as attachments; the colour palette will be built from the colour list in your brief (mint, teal, light blue, cream, beige, mustard, gold, blush, coral, navy, white).

## Brand identity

- Logo used exactly as provided (no redraw, no recolour), served via CDN asset pointer; a square copy becomes the app favicon and PWA icon.
- Gate photograph used only on the login screen, as a softened/darkened full-bleed background with mobile-smart cropping (focus kept on the crest and ironwork).
- App name becomes "Dawn Breakers School"; motto "Morality Before Materiality" appears subtly on login and in the account footer.

## Design system rework (`src/styles.css`)

- Replace the current navy/grey token set with the full coordinated palette: navy for primary text/actions, cream & beige surfaces, white cards, mint/teal for positive, coral/blush for negative, mustard/gold for warning-highlight, light blue for info.
- Typography: one modern sans (loaded via `<link>` in the root route) with a defined scale for page title / section heading / metric numbers / body / metadata.
- Consistent radii, two subtle shadow levels, hairline borders, generous mobile spacing. No gradients beyond one restrained login overlay, no glassmorphism, no emojis.
- Lucide outline icons only, uniform size and stroke weight.

## Navigation

Keep the existing role-based nav architecture, restyled:
- Parent bottom tabs: Home, Children, Updates, Account.
- Teacher: Classes, Attendance, Import, Account. Admin keeps its existing items.
- Refined mobile bottom bar with comfortable touch targets and safe-area padding; sidebar retained for tablet/desktop.

## Screens

Redesigned existing: login, parent home, student profile, account, teacher classes, admin overview/students/import/import history (restyled to the new system, functionality untouched).

New screens (realistic mock data, presentation-ready):
- My Children — premium child cards with photo, class/division, roll number, attendance %, character score.
- Attendance — student selector, overall percentage card, four state counters, monthly calendar with colour-coded status dots, minimal trend chart, monthly summary list.
- Teacher Feedback — teacher avatar, date, subject, feedback text cards.
- Character Card — current score, positive/negative points, trait breakdown (Respect, Responsibility, Honesty, Discipline, Kindness, Cooperation), point history.
- Notifications — categorised centre with unread indicators, plus the existing notification-permission prompt integrated naturally.
- Teacher Attendance — class/date header, fast per-student Present/Absent/Late/Left Early controls, Mark All Present, sticky Save Attendance.

Login: Parent tab default (GR Number + Parent Phone Number, "Forgot password?"), Teacher/Admin tab keeps email + Google sign-in. Existing GR-alias sign-in logic unchanged.

## Technical notes

- New routes under `src/routes/_authenticated/parent/` and `/teacher/` as TanStack file routes, each with its own `head()` metadata.
- Mock data lives in a single `src/lib/mock/` module clearly marked as UI-only, so real data can be wired in later without touching layout.
- Existing server functions, RLS, import wizard and validation are left as-is; only presentation code changes.
- Student photos use tasteful placeholder avatars with initials fallback.
- Verified at 390×844, tablet and desktop widths; no horizontal scroll.

## Out of scope

Fees, payments, transport, timetable, chat, homework, exams, report cards, library, extra analytics, and any database or auth changes.
