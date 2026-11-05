# Closed-app school notifications

Status: prepared for review, NOT deployed or verified on physical devices. No Lovable credits used.
Rollback baseline: `639956c75a910bdc66ffdd98ba5720353c8fb5cb`.

## Verified live configuration gap (2026-11-05)
The live `/assets/account-CpLAT15z.js` bundle references four Firebase environment properties absent from its embedded public environment object. They consequently evaluate to undefined; `enablePush` returns `not-configured` before registration on every platform. The tracked .env also lacks these values. This is evidence of missing browser configuration, not proof of the state of private server secrets.

The build needs these PUBLIC values from the SAME Firebase project:
- VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID
- VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY (public Web Push certificate key)
- VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY
- VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID

Do not invent these values or commit private keys. Configure the hosting build environment and rebuild. Enable Firebase Cloud Messaging HTTP v1 for that project.

The existing account-service host must deploy this revision, including `/api/public/push`. It needs its existing backend master key and either FIREBASE_SERVICE_ACCOUNT (server secret JSON from the matching Firebase project) or its existing LOVABLE_API_KEY + FIREBASE_MESSAGING_API_KEY connector secrets. No backend master key needs to be added to Cloudflare. Cloudflare forwards only the signed-in caller's bearer token to the existing ACCOUNT_SERVICE_URL, over HTTPS without following redirects. Deploy account-service first, then the main app.

## Scope
No DB migrations, schema changes, new dependencies, student/attendance/academic/character changes, or authentication-policy changes. Existing notification preferences, inbox rules, publication functions and once-only claim are retained. Sign-out gains best-effort device subscription cleanup; cleanup failures do not stop sign-out.

The browser checks provider readiness and successful token persistence before showing registration success. Previously opted-in devices refresh registration on reopen without asking permission again. Firebase worker has a dedicated scope, and clicks open the correct same-origin role inbox. Firebase notification payloads are not shown a second time by the custom worker or page polling.

Delivery selects current recipients server-side, checking preferences and active/non-deleted teacher status. There is no assumed profiles foreign-key join and no persistent staff topic membership that survives a role deletion. Recipient lookups are bounded to 200 tokens/page; delivery concurrency is 20. Direct Firebase OAuth credentials are cached server-side for 50 minutes and reset on failure/rotation.

## Validation and limits
Run `npx tsc --noEmit`, `npx vitest run --config vitest.student-details.config.ts`, and `npm run build`. Tests cover actual worker execution, isolated worker lifecycle, server-confirmed status, role routing, opt-out/deleted teacher exclusion, claim rejection, missing provider, paging and delivery failure.

After configuration/deployment, opt in from Account > Notifications on one controlled device per role. Publish only a specifically authorized test update; verify one notification after closing the app, correct inbox on click, no alert for edits/republication, opt-out and sign-out, and retained offline operation after reopening. Do not broadcast a test announcement to real school users without authorization.

On iPhone/iPad, web push requires a supported OS/browser and the app installed to the Home Screen and opened from there. Android/desktop also require browser/OS permission and background delivery support; force-stop/OS restrictions can prevent delivery. No guarantee is made for every OS/browser version or force-closed browser.

As before, the once-only claim is not a durable retry queue: a transient failure AFTER claiming is logged but not automatically retried, avoiding duplicate broadcasts. Missing provider configuration now does not consume the claim. Published updates remain available in the existing inbox regardless of push delivery. Physical-device testing remains required; automated checks cannot prove delivery to the user's phone.

## Revert
Before merge, close this draft PR to leave production unchanged. After merge/deployment, revert the notification commit with a new revert commit and deploy both hosts. Do not reset or force-push history. No data migration needs reversing. Historical notifications are not resent.
