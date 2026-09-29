# Full read-only audit of Dawn Breakers School PWA

This is an audit only. No code, data, permissions, UI or test data will be changed. Nothing is added, seeded, fixed or deleted.

## What will be checked
All 15 areas from your checklist:
1. Sign-in and roles
2. Parent screens
3. Academics
4. Teacher screens
5. Admin screens
6. Parent management
7. Excel import
8. Photo security
9. Security and permission rules
10. Data integrity
11. Updates
12. Attendance reports
13. Mobile and PWA
14. Branding
15. Build

Every item gets a PASS, FAIL or NOT IMPLEMENTED.

## How each area is verified
- **Code review:** read every route, server function and shared component involved.
- **Database (read-only queries):** tables, constraints, permission rules, helper functions, storage rules, and current row counts (including the duplicate attendance constraint and GR uniqueness).
- **Live browser checks:** Playwright at desktop (1280px) and phone (375px) widths, signed in as:
  - the admin account
  - the teacher demo account
  - the demo parent (GR 202600145)

  Each run captures screenshots and checks for sideways scrolling.
- **Access checks:** try opening admin pages as a parent or teacher, open unlinked student IDs by URL, and try server calls with IDs the account shouldn't reach. These are only reads, or writes that are expected to be refused. Nothing is written successfully.
- **Branding search:** search the whole project for "School Connect", other wrong names and page titles, plus the Excel template name.
- **Build:** run the existing type check and read the latest build status.
- **Photo checks:** confirm the 3 MB limit, allowed file types, private storage, signed links and removal of old files. Also report whether photos are compressed or resized before they're saved.

Anything that can't be tested safely without writing data, such as a hostile teacher write attempt, is marked **Not verified hands-on**, with the rule that enforces it.

## Report format
- One PASS/FAIL/NOT IMPLEMENTED table for each of the 15 sections.
- For every FAIL or NOT IMPLEMENTED item:
  - Feature
  - Exact screen or file
  - Problem
  - Severity (Critical/High/Medium/Low)
  - Whether code changes are needed
- A short list of the test and demo data found, for reference only. None of it is deleted.
