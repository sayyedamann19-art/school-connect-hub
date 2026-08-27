# Parent Login, Excel Import & Student Management

Builds on the existing V1 foundation (auth, schema, RLS, app shell) — nothing existing gets rebuilt.

## 1. Parent login with GR number + phone

- Students gain a unique **GR number**; students also gain height and weight.
- Parents gain a hidden internal login alias (e.g. `parent.9876543210@parents.schoolconnect.app`). Parents never see or type it.
- Sign-in screen gets two tabs:
  - **Parent** — Login ID (GR number) + Password (phone number by default)
  - **Staff** — existing email/password + Google sign-in
- Parent sign-in resolves the GR number to that student's parent account server-side, then signs in normally through Lovable Cloud auth. Passwords are always hashed by the auth system — never stored in a table.
- Dashboard shows every child linked to that parent account, not just the GR number used to sign in.
- New **Account settings** screen for parents to change their password at any time (optional, not forced).
- Wrong GR/phone returns one generic "check your login ID and password" message so the form can't be used to probe which GR numbers exist.

## 2. Official Excel template

A **Download Excel template** button in both the Admin and Teacher areas produces an `.xlsx` with:

- **Sheet 1 — Student Data**: Roll Number, GR Number, Student Name, Height, Weight, Class, Division, Parent Name, Parent Phone Number. Header row styled/frozen, text format on GR and phone columns so leading zeros survive, numeric validation on height/weight, one greyed example row.
- **Sheet 2 — Instructions**: meaning of each column, required vs optional, expected format, example values, GR uniqueness rule, 10-digit phone rule.

## 3. Import flow

`Download template → fill → upload → validate → preview → confirm → import`

Nothing is written to the database before confirmation.

Validation (all client-side, before any write):
- File must be `.xlsx`; header names must match the official template exactly; unexpected columns are reported, not silently ignored
- Required: GR Number, Student Name, Class, Parent Name, Parent Phone Number
- GR number unique within the file and checked against existing students
- Phone must be a valid 10-digit number; height/weight numeric if present; roll number valid within its class
- Class teachers may only import rows for classes they are assigned to; other rows are rejected with a clear reason

Validation report, e.g. `25 records found · 22 valid · 2 duplicate GR numbers · 1 missing parent phone`, followed by a preview table that flags each row as **Create**, **Update**, **Warning** or **Error** with the reason. Errors are never imported. Confirm button states exactly how many will be created and updated.

## 4. Import execution

On confirm, a single server operation:
- Creates the class/division if it doesn't exist yet
- Creates a student for a new GR number, updates the existing student when the GR number already exists (never a duplicate)
- Creates or reuses the parent account by phone number — one account per phone, so siblings share the same parent login
- Links parent to student; existing links are preserved
- Returns per-row created/updated/failed results shown in a summary screen

## 5. Manual student management

- New **Admin → Students** screen: searchable, filterable list with class/division, GR, roll number, parent name.
- **Edit student** dialog (Admin and authorized class teachers) covering name, roll number, class, division, height, weight, date of birth, active status, parent name, parent phone, student photo upload, and GR number **for admins only** (the field is read-only for teachers).
- Teachers reach the same editor from their class list for their own students only.
- Every edit writes to the same student record the parent dashboard reads — one source of truth, no separate import store.
- Parent-student linking stays admin-only; a link change is visible on the parent dashboard immediately.

## 6. Import history

Admin **Import history** screen listing date/time, uploaded by, total records, created, updated, failed — with a per-run detail view.

## Out of scope

No fees/payments, transport, timetable, chat, or other new modules.

## Technical notes

- **Schema:** add `gr_number` (unique, not null), `height_cm`, `weight_kg` to `students`; add `parent_profiles`-side fields for parent phone/alias on `profiles`; new `student_imports` table (uploaded_by, counts, status, error detail JSON) with grants + RLS. New helper `can_edit_student(student_id)` so teacher edit permissions live in the database, plus RLS policies letting authorized class teachers update the permitted student columns while GR number and parent linking remain admin-only (enforced by a trigger that rejects GR changes from non-admins).
- **Auth:** parent accounts are created inside an admin-guarded server function using the privileged auth admin API with `email_confirm: true`; the GR→alias lookup is a narrow server function that returns only the alias, no student data.
- **Excel:** `exceljs`, dynamically imported in the browser only when generating the template or parsing an upload, so the server bundle and initial page load stay unaffected. Parsed rows are validated with Zod, then sent to an authorized server function for the actual writes.
- **Server functions:** new `src/lib/students.functions.ts` and `src/lib/import.functions.ts` using `requireSupabaseAuth`; privileged auth-admin work is loaded inside handlers. Routes added under `src/routes/_authenticated/` for admin students, admin import, admin import history, teacher import, and parent account settings.
