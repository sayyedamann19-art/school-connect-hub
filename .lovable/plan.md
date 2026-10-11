# Cloudflare-safe account actions (GR login, creating logins, import, parent management)

## What exists today
All seven actions live in TanStack server functions that load the master backend key (`supabaseAdmin`):
- `resolveParentLogin` (parent-auth.functions.ts) — public, returns the parent's hidden login email (or null) for a GR number.
- `adminCreateTeacher`, `adminCreateStudent` (+ parent login), `adminSetParentActive`, parent password change (admin.functions.ts).
- `runStudentImport` (import.functions.ts) — creates classes, students, parent logins and links.
- `updateStudent` parent phone change (students.functions.ts) — also changes the parent's login email.

Lovable Cloud never hands this key out, so it can't be added to Cloudflare. On Cloudflare these calls fail.

Two security gaps in the current GR login, fixed by this plan:
1. It answers differently for an unknown GR number (null) and a real one (an email), so anyone can check which GR numbers exist.
2. The email it returns contains the parent's phone number (`parent.<phone>@parents.dawnbreakers.app`).

## Recommended architecture: one backend function on Lovable Cloud
Add a single backend function named `account-admin`. It runs inside the existing Lovable Cloud backend, which already holds the master key. The key stays there and never touches Cloudflare, GitHub or the browser.

```text
Browser (Cloudflare site)
  └─ server function on Cloudflare (unchanged entry points, same UI)
       └─ HTTPS POST  <backend>/functions/v1/account-admin
            headers: Authorization: Bearer <caller's own sign-in token>
            body:    { action, ...validated fields }
          account-admin (Lovable Cloud backend)
            1. verifies the token with the auth service → real user id
            2. checks the role in user_roles (never from the request)
            3. runs the privileged step, then returns a minimal result
```

The Cloudflare server functions keep their names and inputs, so the screens don't change. Only the privileged lines move into `account-admin`. Everything that already works with the user's own permissions (RLS) stays in Cloudflare: class lookup, student insert by an admin, parent links.

### Actions and authorization
| Action | Who may call | Server checks |
|---|---|---|
| `parent_sign_in` (GR + password) | anyone, no sign-in | Looks up the GR number and signs in on the backend. Always returns the same message, "GR number or password is incorrect", for an unknown GR, a GR with no parent, or a wrong password. Returns only the session tokens on success; the browser never sees the email. |
| `create_teacher` | admin | email/password format checks; creates the login, profile, teacher role and teacher row |
| `create_parent_login` (used by add-student and import) | admin; or teacher only for a student in their own class | re-checks `teaches_student(student)` for teachers; reuses an existing parent with the same phone; links only that student |
| `set_parent_active` | admin | target must have the parent role (can't suspend admins or teachers) |
| `set_parent_password` | admin | target must be a parent; 8–72 characters |
| `change_parent_phone` | admin | target must be a parent linked to that student; updates the login email and profile together |

Import: the Cloudflare server function keeps its current server-side checks and writes. For each row that needs a new parent login, it calls `create_parent_login` with up to 50 rows per call, to stay under Cloudflare's request limits. It's an all-or-skip per row, the same as today.

### Abuse protection for GR login
- A failed-attempt counter per GR number and per IP address, stored in a new private table `login_attempts` that no app user can read. After 5 failures in 15 minutes, every attempt for that GR or IP gets the same generic error, plus a short delay.
- Failures always take the same time whether the GR exists or not.

## Configuration
Already supported (nothing to add):
- The backend function gets the master key automatically inside Lovable Cloud.
- Cloudflare already has the backend address and public key (`wrangler.jsonc`), which is all it needs to call the function.

Needs to be added:
- Allowed-origin list for the function: `https://dawnbreakerschool.app`, `https://www.dawnbreakerschool.app`, the `*.pages.dev` address and the Lovable preview. Set in code, not a secret.
- No new secrets, no Cloudflare secrets, no DNS changes. The function is deployed from Lovable, so you won't need to deploy anything extra.

## Security risks and how they're handled
- **Stolen or forged token.** Every call is verified with the auth service. Roles come only from the database.
- **Teacher overreach.** Teachers can only create parent logins for students in their own classes. They can't create teachers or suspend or change any parent.
- **Admin accounts targeted.** Suspend, password and phone actions refuse any account that isn't a parent.
- **GR guessing.** One uniform answer, rate limiting, and no email or phone is ever returned.
- **Existing data.** No records, login emails or links are rewritten. Existing parent login emails stay as they are, and phone changes only touch the one parent being edited.
- **Key exposure.** The key lives only in Lovable Cloud. The function never returns or logs it, and nothing is added to `VITE_` variables, `wrangler.jsonc` or GitHub.

## Tests
Automated tests in the project, for the rule logic:
- GR sign-in gives an identical response for an unknown GR, a GR with no parent, and a wrong password.
- Lockout starts after 5 failures.
- A teacher is refused for a student outside their class.
- A non-admin is refused for create-teacher, suspend, password and phone.
- Suspend and password are refused when the target is an admin or teacher.

Live tests against the backend function (I'll run these after building):
- No token → 401; parent token → 403 on admin actions.

Manual production tests on Cloudflare after deploy (you):
1. Parent signs in with the GR number. A wrong password and an unknown GR show the same message.
2. Admin adds a teacher, then signs in as that teacher.
3. Admin adds a student with a parent phone; the parent signs in with the GR number.
4. A teacher imports a file for their own class; a row for another class is rejected.
5. Admin suspends a parent (sign-in blocked), restores them (works), changes their password and phone, and the parent signs in with the new details.

## Files expected to change
- New: the `account-admin` backend function, the `login_attempts` table (private, with RLS and no app access), and tests.
- Updated: `parent-auth.functions.ts` (replaced by sign-in through the function) and the sign-in form in `routes/index.tsx` (sets the returned session). `admin.functions.ts`, `import.functions.ts` and `students.functions.ts` swap their `supabaseAdmin` lines for calls to the function.
- `push.functions.ts`: the stale-token cleanup is optional; on Cloudflare it already skips safely.
