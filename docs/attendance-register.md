# Printable class attendance register

Location: Admin > Attendance > Print class register. Select a class, select one month, preview, then Print / Save PDF. The output uses a named A3 landscape page with 10 mm margins. Existing marksheets keep the unnamed A4 page rule.

The register is a read-only view of the existing students and attendance tables. It includes roll number, student name, GR number, DOB, age as of the reporting cutoff, mother name, address and student contact number. No parent account data, feedback, character points or exam results are queried. All students currently linked to the selected class are included, following the existing report's roster behavior. The system has no historical class-enrolment or school-holiday calendar; the register does not invent either.

Each marked status is printed separately. U means an unrecorded past/current date; - means a future date. Neither is treated as absence. Sundays are not automatically marked closed. Percentages preserve the existing app formula: Present / recorded attendance rows, rounded to a whole number; late, left-early and other remain separate statuses. Age is calculated at month end for a historical month, or today's school date for the current month.

The server checks admin access before reading, uses the caller's RLS session, and pages both students and attendance to avoid PostgREST result truncation. Read failures or duplicate student/date attendance abort the register instead of yielding successful partial totals. There are no writes, migration, auth changes, teacher permission changes or account-service changes.

Preview and print share one React renderer. The preview captures class and month in its query key and removes print content while loading, refreshing or errored. Pagination reserves more space for long profile fields, with no shrinking of profile text. Headings use normal word wrapping; addresses and long identifiers can wrap within their cells. The register portal is excluded from the existing print-hide selector, while its named @page rule isolates A3 styling from the existing A4 marksheet.

Validation commands:

```sh
npx tsc --noEmit
npx vitest run --config vitest.student-details.config.ts
node --test scripts/check-staff-student-records.mjs scripts/check-student-delete.mjs
npm run build
```

Automated tests cover month lengths, leap years, future dates, missing records, per-child isolation, profile/age, numeric roll order, class filtering, permission failure, server read failure, 501 students with 15,531 attendance records, long-profile pagination, HTML escaping and preservation of the A4 print rule. The React output was rendered to an A3 PDF for layout validation with 23 fictional students including a long address; all 4 pages retained headings/signature spaces and every student.

Rollback point before this feature: 67842b8fa2c2d2816eb7a17ae0d36e7adbc0ecbb. Revert the feature commit and redeploy normally if needed; no database rollback is required. Never rewrite published Git history.
