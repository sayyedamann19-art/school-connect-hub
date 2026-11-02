# Teacher employment details

Admins can record and edit a teacher's joining date and educational qualification in Teachers → View details. Add Teacher defaults the joining date to the current day in Asia/Kolkata. Existing teachers show “Not recorded” until an admin supplies their actual details. Qualification is optional and limited to 200 characters.

The existing email/password sign-in, role checks, class assignments, activation/deletion controls and account creation timestamps are unchanged. The account service accepts the new optional fields and includes them only in the teacher-record insert; credential creation is unchanged.

## Deployment order

1. Apply `drizzle/migrations/0018_teacher_employment_details.sql` through the existing Drizzle migration process. It adds nullable columns, then sets a default for future joining dates. It does not backfill historical dates or change policies.
2. Deploy the updated account service at `accounts.dawnbreakerschool.app` before the updated main app. Otherwise its old validator would discard the new fields during teacher creation.
3. Deploy the main app. Do not deploy its new teacher queries before the migration, because they select the added columns.
4. Verify on the deployed system: existing email/password login; create a test teacher with a backdated joining date and qualification; reopen their details; edit both values; check a different existing teacher still shows unknown details; check non-admin access is denied. Remove only the test account afterward.

## Validation completed locally

- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx vitest run src/lib/teacher-details-input.test.ts`: 12 tests passed, including real calendar dates, leap years, India midnight boundaries, formatting and qualification limits.
- Separate 26-check harness: passed shared validation, backward-compatible create payloads, required email, new-field retention, denied non-admin update, and the migration against PostgreSQL via PGlite. Database checks confirmed unknown historical dates, preserved account timestamps, current-day defaults on new records, editable dates, qualification round trips and length constraints.
- Live deployment and browser testing are pending; local checks do not establish production behavior.

## Reverting the feature

Revert the feature commit and redeploy the earlier main app and account service. Leave the added database columns in place to preserve entered details; the earlier code ignores them. No login migration or account reset is needed.
