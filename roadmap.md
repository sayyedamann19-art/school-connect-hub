# Roadmap

## In progress — typography-only readability update (approved scope)
- [x] Central typography changes in src/styles.css + __root.tsx (Inter for screen UI, 16px body/inputs, 14px floor for meta/labels/text-xs)
- [x] TypeScript check, existing vitest suite (92 passed), production build
- [x] Signed-out visual checks at 390px and desktop (login, staff tab)
- [x] Restore src/integrations/supabase/types.ts to exact content at 53902f5 (revert unrelated auto-reordering)
- [x] Re-run typecheck + production build after types.ts restore (both pass)
- [x] Run record/deletion check scripts (10 + 8 assertions pass)

## Constraints from user (2026-11-03)
- No signing in as any parent/teacher, no session minting, no inspecting private login info
- Keep all font improvements; revert only types.ts reordering
- Do not publish
