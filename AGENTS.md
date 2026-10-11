<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Academics: exams/subjects/results are separate tables; parents see results only when the exam status is published (RLS via exam_is_published), teachers can write only draft exams — keeps partial marks hidden from parents.
- Academics: per-class subject format lives in class_subjects (layout + default max only); results stay in academic_results so template edits never alter recorded marks.
- Alias `exceljs` to its browser build in vite.config.ts — the Node entry needs createRequire, which crashed the edge server on cold start.
- Resolve shared school branding asset pointers against the project's Lovable asset-serving origin in `src/lib/brand.ts` — external hosts do not serve the root-relative `/__l5e/assets-v1/` endpoint.
- Self-hosted Cloudflare deploys get the public backend URL and publishable key at runtime from `vars` in root `wrangler.jsonc` (merged into the generated wrangler.json) — server functions read process.env, which Cloudflare otherwise leaves empty; never put private secrets there.
- Server entry (src/server.ts) fills missing SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY from Cloudflare bindings or the build-time VITE_ public values — external hosts may not inject them, and server functions read process.env; never fall back to private secrets.
- Updates: one shared school_updates table and UpdatesManager UI for admin and teacher; teachers manage only rows they authored (RLS on created_by) — avoids a duplicate updates system and keeps admin-only control over others' notices.
- Update notifications: parent unread state lives in update_reads (per user, per update) and first_published_at is stamped once by trigger — re-publishing or editing never re-notifies; pop-ups are announced once per device keyed by update id.
- Closed-app push: parents join one FCM topic; sends call claim_update_push (atomic once-per-update, admin/author only) and use the FIREBASE_SERVICE_ACCOUNT server secret directly, falling back to the Lovable gateway — avoids needing the master backend key on Cloudflare.
- Cloudflare-safe server functions: read/write as the signed-in user (context.supabase) plus narrow SECURITY DEFINER helpers (set_student_photo, import_student_lookup, get_student_parent_contacts, list_my_class_parents, admin_parent_account_status) — Cloudflare has no service-role key; login creation/password/suspension/GR sign-in go through src/lib/account-admin.server.ts, which runs locally when SUPABASE_SERVICE_ROLE_KEY exists and otherwise forwards to the Lovable-hosted /api/public/account-admin (ACCOUNT_SERVICE_URL) with the caller's bearer token; the route re-verifies token and DB role every call. Supabase Edge Functions are not allowed in this project.
- Teacher deletion is a soft delete (deleted_at + role/assignment removal) via admin_delete_teacher; class deletion runs in admin_delete_class with a row lock — keeps attribution/history and prevents races.
- Staff update notifications reuse school_updates + update_reads; listStaffInbox filters by the caller's DB role (admin gets teacher-sent, active teachers get admin-sent) — no separate notification table.
- Localization: parent portal strings go through useT() from src/lib/i18n.tsx with English text as the key and per-language dictionaries in src/locales (parts merged); preference stored in profiles.preferred_language plus localStorage; staff screens always render English — one codebase for all languages.
- Dashboard counts follow list-page rules: teachers exclude soft-deleted (deleted_at), students count only active — avoids counting removed records.
