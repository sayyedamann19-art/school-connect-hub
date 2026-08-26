# School Parent–Teacher PWA — V1 Foundation

Build the shell, routing, role architecture, design system, PWA setup and database foundation. Modules stay as scaffolded placeholders.

## Backend foundation

Enable Lovable Cloud (managed Postgres + auth + storage, no external account needed) and create:

- `profiles` — one row per user (full name, phone, avatar), auto-created on signup by trigger
- `app_role` enum (`admin`, `teacher`, `parent`) + `user_roles` table (separate from profiles) + `has_role()` security-definer function
- `classes` — name, division, academic year
- `students` — name, class_id, roll number, DOB, photo path, status
- `teachers` — profile link, employee code; `class_teachers` — teacher ↔ class assignment
- `parent_students` — parent profile ↔ student link, relationship type (admin-only writes)
- `attendance` — student, date, status (`present`, `absent`, `late`, `left_early`, `other`), note
- `teacher_notes` — student, teacher, date, subject/class, note text
- `character_points` — student, teacher, points (+/-), reason, date; student score derived by sum
- Private storage bucket for student photos

RLS on every table, with explicit grants:
- Parents read only students linked to them via `parent_students`, and only those students' attendance/notes/points
- Teachers read/write only students in classes they are assigned to
- Admins full access via `has_role(auth.uid(), 'admin')`
- No anonymous access anywhere

Data access goes through server functions using the signed-in user's session, so the database enforces access — not the UI.

## Routes

- `/` — login (email + password), redirects by role after sign-in
- `/parent` — parent dashboard: linked children as student cards, selection
- `/parent/student/$studentId` — profile shell with tabs: Overview, Attendance, Teacher Notes, Character Card
- `/teacher` — teacher area shell: assigned classes/students
- `/admin` — admin area shell: sections for students, classes, teachers, parent links
- Parent/teacher/admin routes live under an authenticated layout; each area additionally checks its role and shows an unauthorized state otherwise

Module pages render real layout with empty/loading states, not full functionality.

## Design system

Light background, deep navy primary, subtle status colors (green present, amber late, red absent, slate other), rounded cards, soft shadows, clear type scale. All tokens semantic in `src/styles.css`; no hardcoded colors in components. No gradients or glassmorphism.

## Reusable components

App shell (header + sidebar on desktop, bottom nav on mobile), card, student card, profile section, stat tile, data table, form fields, buttons, status badge, skeleton loaders, empty state, error state, dialog, toasts.

## PWA

Web app manifest with icons and theme color, service worker registration (offline shell caching), installable on phone/tablet/desktop, mobile-first responsive layout. Notification permission request is scaffolded (a hook + placeholder subscription table wiring) but not wired to a push provider in V1.

## Deployment

Standard build output suitable for GitHub → Cloudflare Pages; no Vercel-specific config. Env vars are provided by Lovable Cloud; the Cloudflare project only needs the build command and output directory.

## Out of scope for V1

Fees/payments, transport, timetable, messaging, public website, extra analytics.
