# Student registration details rollout

The admin's New student form and both staff Excel import flows collect roll number, student name, GR number, date of birth, mother's name, address and student contact number. Age is calculated from DOB as of the current date in Asia/Kolkata; no age column is stored in the database. Excel includes a TODAY-based age formula, but imported age values are ignored and recalculated by the app.

Student contact number and mother name are independent of the linked parent's account name and login phone. Existing parent creation, sibling linking, class restrictions, RLS and student IDs are retained. Teacher access remains class-scoped import; this change does not grant teachers manual admin access.

Existing students remain readable and editable when the added fields are null. New students and imported rows must contain the new required details. Old Excel templates receive a missing-column error without importing any rows; staff should download the new template. Height, weight, class, division and parent account fields remain in the template.

## Required deployment order

1. Apply `drizzle/migrations/0019_student_registration_details.sql` through the existing authorized PostgreSQL migration process. It only adds three nullable columns and checks, preserving all existing rows and RLS policies. Its journal entry is included for the existing Drizzle workflow.
2. Deploy the updated account service and the application together. Cloudflare forwards privileged create/import calls to the existing account service; deploying only Cloudflare would leave an older service that strips the new fields. Do not treat that as a complete rollout.
3. Publish the application only after the database fields and account service are ready. Until then keep this change off `main`, whose changes may automatically deploy.
4. Manually verify: create a clearly marked test student with all fields, reopen Edit and View record, then import a new student with another GR number. Confirm all fields persist and parent login phone remains separate from student contact. Verify assigned-teacher import succeeds and another class is rejected. Clean up explicitly identified test data afterwards.

No live database migration or live test is claimed by the code checks.

## Checks

```sh
npx tsc --noEmit
npx vitest run --config vitest.student-details.config.ts
node --test scripts/check-staff-student-records.mjs scripts/check-student-delete.mjs
npm run build
```

The workbook tests serialize and reload real XLSX workbooks, including Excel date cells, numeric date serials, the 1904 date system, example rows and age-only formula rows. Account service tests use a mock database; they do not substitute for the final deployed smoke test.

## Rollback

Previous working main: `3b9dba640803437752cc42cb29f2b65e57f0eb5b`.

Before merging, the live system needs no rollback because this branch is isolated. After deployment, revert the feature commit and redeploy both the account service and app. Keep the added nullable database columns so any entered details are retained. Do not drop columns or rewrite published Git history.
