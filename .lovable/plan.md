# Dawn Breakers School — Audit and Road to Production V1

Read-only audit of the live project. Nothing was changed.

## 1. Working on real data

- Sign-in: parents by GR number + phone, staff by email or Google; role-based routing and access gates
- Parent: home, My children, student profile (name, class/division, roll, GR, DOB, height, weight, photo), attendance (calendar, counts, percentage, monthly/yearly trend), teacher feedback, character card, account/password
- Teacher: assigned classes, class roster, attendance marking and editing, feedback notes, character points, Excel import for own classes
- Admin: overview counts, student list and editing, Excel template/import wizard, import history
- Photos: signed private links work end to end, but no photos have been uploaded yet (0 files)

## 2. Still demo or missing

- Parent Updates screen (`/parent/notifications`) runs entirely on in-app demo content; there is no notifications table and no push delivery
- Teacher overview has a "Pending attendance — Coming in the next module" tile and "Read-only in V1" wording
- Admin overview shows four "Module coming next" placeholder cards
- Admin missing entirely: class/division management, teacher management and class assignment, parent-account management, attendance reports, exports/report cards, single-student create and deactivate
- Parent navigation bar omits Attendance, Feedback and Character card (reachable only from inside pages)

## 3. Database and security

Tables: profiles, user_roles, classes, teachers, class_teachers, students, parent_students, attendance, teacher_notes, character_points, student_imports. One private photo bucket.

Row-level security is enabled on every table with role/relationship helper functions; no anonymous access; admin-only guard on GR number changes; all data access runs through server functions as the signed-in user; no privileged keys anywhere in browser code.

Roles: admin full access; teacher limited to assigned classes (re-checked server-side on every write); parent read-only and limited to linked children.

Findings to clean up:
- Duplicate uniqueness rules on attendance (student + date) exist twice — harmless but redundant
- Teacher and parent write-rejection has been verified through the server checks, not by a direct hostile request

## 4. Branding leftovers ("School Connect" should be "Dawn Breakers School")

- Page titles/descriptions: teacher overview, student profile, no-access, and the admin screens
- Excel template: workbook author and the Instructions sheet title
- Hidden parent login addresses use `parents.schoolconnect.app` (visible to admins and on the account screen)
- Internal notification storage key

## 5. Data currently in the database

3 accounts, 1 class (Grade 5-A 2026-2027), 2 teacher records, 2 students (Ayaan, Zoya), 4 parent links, 298 attendance records, 2 feedback notes, 2 character points, 0 imports, 0 photos.

All of this is development data except the admin account itself. Test logins: teacher.demo@dawnbreakers.edu, parent GR 202600145/202600146, admin via Google.

## 6. GitHub and deployment

Repository is connected and committing. Publishing through Lovable works today. For the GitHub to Cloudflare Pages path, the build command and output directory still need to be set up on Cloudflare, with the school's domain attached and backend keys configured there. Installable app files (manifest, icons, offline worker) are in place but installation has not been tested on a real phone.

## 7. Required for production V1

Must do:
1. Real Updates/notifications source (replace the last demo screen)
2. Admin class and division management
3. Admin teacher management and class assignment (attendance access depends on it)
4. Admin single-student create, edit and deactivate
5. Admin parent-account management (relink siblings, reset phone/password)
6. Rebrand all remaining "School Connect" text and the parent login domain
7. Remove demo students, demo attendance, demo notes/points, test accounts and the extra roles on the admin account
8. Remove the placeholder tiles on teacher and admin overviews
9. Add Attendance, Feedback and Character to parent navigation

Should do:
10. Admin attendance overview and daily/monthly reports
11. Student photo upload
12. Drop the duplicate attendance uniqueness rule
13. Hostile-request tests for teacher and parent writes
14. Cloudflare Pages setup, custom domain, and install test on a real phone

Optional/later: Excel/PDF exports and report cards, real push delivery, holiday calendar excluded from percentages, bulk/offline attendance, promotion to next academic year.

## 8. Summary

Roughly 65% of a production V1. Everything a parent and teacher does day to day is real; the gap is admin management screens, notifications, branding cleanup and go-live setup.

## Proposed next step

Approve this and I will start with the admin management screens (classes, teachers with class assignment, single-student create/edit) since every other module depends on them, then branding cleanup and demo-data removal.
