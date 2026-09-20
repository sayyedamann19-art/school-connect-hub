# Connect the Parent area to real school records

Right now the parent home and child list show demo children (Aarav and Ishani Sharma). This change makes those screens show the real children linked to the signed-in parent, pulled securely from the school database.

## What changes

**Parent home (`/parent`)**
- Loads the signed-in parent's own name and their linked children from the database.
- The child switcher and the summary card use real children. No demo children for a signed-in parent.
- Loading skeletons while data arrives, a retry message on failure, and a clean empty state ("No children linked to your account yet — please contact the school office") when there are no links.
- Each child card shows real name, class, division, roll number, GR number, and the student photo when one is on file (initials fallback otherwise).
- Tapping a child opens that child's existing profile screen.

**My children (`/parent/children`)**
- Same real data, same card layout, same loading/error/empty states.

**Student profile (`/parent/student/$studentId`)**
- Adds GR number, height and weight to the existing details list, and shows the real photo when available.
- A student who is not linked to the signed-in parent returns nothing, so a hand-typed student ID shows "Student isn't linked to your account" rather than any data.

**Unchanged**
- Attendance, Teacher feedback, Character card and Notifications keep their demo content for now (those modules aren't built yet). The attendance percentage and character points shown on the child cards come from real records where they exist, otherwise they read as "—".
- Authentication, permissions, Excel import, student management, teacher/admin screens, app shell and visual design are untouched.

## Technical notes

- Extend the existing `getMyChildren` and `getStudentOverview` server functions in `src/lib/school.functions.ts` to also select `gr_number`, `height_cm`, `weight_kg` and to resolve the parent's own profile name. Both already run through `requireSupabaseAuth`, so every read executes as the signed-in user and existing row-level security on `parent_students` / `students` remains the only boundary. No schema, policy, grant or RLS change is needed, and no service-role key enters browser code.
- Student photos live in the private `student-photos` bucket. The server function returns a short-lived signed URL per student (created with the user's own session, so the same policies apply); the components fall back to the existing initials avatar when there is no photo.
- Add a small per-child attendance/character rollup to `getMyChildren` (counts already readable under existing policies) so cards can show real percentages.
- Fetch with `useQuery` in the parent components, reusing the existing `LoadingCards`, `ErrorState` and `EmptyState` components.
- `src/components/parent/child-switcher.tsx` currently imports the mock list directly; it becomes a presentational component that takes children as props. `src/lib/mock/school-data.ts` stays in place for the screens still using it.

## Verification

- Sign in as the parent account (GR 202600145) and confirm both linked children appear with database values.
- Confirm a student ID belonging to another family returns the "not linked" state.
- Check loading and empty states, then run typecheck/build and fix anything this change breaks.
