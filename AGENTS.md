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
