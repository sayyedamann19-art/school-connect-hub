# Admin–Teacher update notifications

## What exists today
- All updates live in one shared table. Admins can see every update. Teachers can see every published update plus their own drafts.
- Parents already have notifications: a pop-up, an unread dot and a history page. Each parent's read/unread status is stored per update, and the first time an update is published gets stamped only once. That's why edits and republishing never notify again.
- Admins and teachers don't have an inbox, an unread dot or pop-ups.

## What will change
Admins and teachers get the same notification system parents already have. There's no new notification table and no change to how updates are created or published.

- **Admin inbox:** published updates sent by teachers.
- **Teacher inbox:** published updates sent by Admin. Only active teachers get them. Deactivated or deleted teachers don't.
- Nobody is notified about their own updates.
- **Drafts and unpublished edits never appear.** An update shows up once it's published. If it's unpublished or deleted later, it disappears from the inbox.
- **No duplicates:** each update counts once per person. Editing or republishing doesn't mark it unread again or show the pop-up again.

## What each person sees (desktop and mobile)
- An unread dot on "Updates" in the Admin and Teacher menus.
- A small pop-up when a new update arrives while the app is open. It shows the title, the sender, and buttons to Open or Dismiss.
- A "Notifications" section at the top of the existing Admin and Teacher Updates pages. Each entry shows the title, sender name, publication time and whether it's unread. Opening one shows the full update and marks it read. There's also a "Mark all read" button.
- Notifications refresh every 60 seconds, when the tab is reopened, and right after you publish something. If loading fails, you'll see "Couldn't load notifications" with a "Try again" button. The unread dot never shows from stale data.

## Existing updates
When this goes live, updates published before today would all show as unread for every admin and teacher. To avoid that, the change will mark them as already read for current staff. Only updates published from now on will notify.

## Permissions
- No new access is added. Teachers still see only published updates plus their own drafts, as today. The server works out each person's role and filters the inbox accordingly, so the browser can't change it.
- Read status can only be written by the person themselves.
- Parent notifications, closed-app push and parent pop-ups stay exactly as they are.

## Testing
- Automated tests for the inbox rules: a teacher's update goes to Admin only, Admin's update goes to active teachers only, nobody gets their own, drafts are excluded, and republishing doesn't create a second unread.
- Live test in the preview with one Admin and one Teacher account. **Caution:** the preview shares records with your live app, so a published test update will also reach parents. I'll publish one short test update in each direction, check both dashboards at desktop and phone width, then delete both. Please confirm this is acceptable and tell me which teacher account to use. If you'd rather avoid it, I'll do the automated tests only.
- Nothing will be published or deployed.

## Technical details
- `src/lib/unread.ts`: add `staffInboxFilter(updates, senders, me, myRole)`, a pure function with tests.
- `src/lib/updates.functions.ts`: add `listStaffInbox`. It uses `requireSupabaseAuth` and `context.supabase` under RLS, checks the caller's role (and `teachers.is_active` for teachers), joins `get_update_senders`, and returns published rows ordered by `first_published_at`. Reuse `listReadUpdateIds` and `markUpdatesRead`.
- `src/hooks/use-staff-updates.ts`: mirrors `use-parent-updates` (polling, invalidation after publish).
- Generalize `UpdateNotifier` to take a data source, and mount it for admin/teacher in `app-shell.tsx` next to the existing parent mount. Show the unread dot on the Updates nav item.
- `UpdatesManager`: add the Notifications section above the existing list.
- Migration: one backfill insert into `update_reads` for current admin and teacher users, covering currently published updates (`ON CONFLICT DO NOTHING`). No schema or policy changes.
