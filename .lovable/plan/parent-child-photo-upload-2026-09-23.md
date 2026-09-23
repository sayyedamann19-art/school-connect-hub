# Parent child photo upload

Let a parent add, replace or remove the photo of a child linked to their own account, from the child's profile page. Photos stay private and every change is checked on the server against the parent–child link.

## Parent experience

On `/parent/student/:studentId`, next to the existing portrait:

- **Upload photo** when none is on file; **Change photo** and **Remove photo** when one exists.
- Choosing a file shows a preview with **Save** / **Cancel** before anything is stored.
- Accepts JPG, JPEG, PNG, WebP up to 3 MB. Anything else is refused with a plain message ("Please choose a JPG, PNG or WebP image under 3 MB").
- Saving shows a spinner on the button, then a success toast; failures show an error toast and keep the old photo.
- Removing asks for a short confirm, then falls back to the initials avatar.
- Layout stays the existing card; controls are full-width buttons on phones.

Nothing else on the profile changes. The "Photo" row in the details list keeps working ("On file" / "Not uploaded").

## Security

- A new server-side upload/remove path verifies the signed-in parent is linked to that exact student before touching anything; a student ID that isn't linked is refused.
- The bucket stays private. Everyone (parent, teacher, admin) keeps viewing photos through the existing short-lived signed links, so admin and teacher screens show the newest photo automatically with no change to them.
- No existing permission rule is changed or relaxed, and no privileged key is used in browser code.
- GR number, parent links and all other student data are untouched by this feature.

## Technical notes

- Reuses the existing `student-photos` bucket and the existing `students.photo_path` column — no new table, bucket or field.
- Storage writes on that bucket are currently admin-only at the database level, and parents have no update permission on `students`. So the write runs in a server function (`createServerFn` + `requireSupabaseAuth`) that:
  1. confirms the link with the `is_parent_of_student` check using the caller's own session (RLS applies),
  2. then performs the storage write and the single `photo_path` update with the privileged client loaded **inside** the handler (`await import('@/integrations/supabase/client.server')`), writing only `photo_path`.
- New functions in `src/lib/school.functions.ts`: `uploadStudentPhoto` (studentId, base64 data, content type; validates mime + decoded size ≤ 3 MB server-side, stores at `students/<studentId>/<timestamp>.<ext>`, deletes the previous object, updates `photo_path`) and `removeStudentPhoto` (deletes the object, sets `photo_path` to null). Both refuse unlinked students.
- Client-side validation mirrors the server limits; the file is read as a data URL for preview and sent as base64.
- New component `src/components/parent/student-photo-editor.tsx` used by the profile route; invalidates the `["student", id, "overview"]` and `["parent"]` queries after a change.
- No schema, policy or RLS migration is required.

## Verification

- As the linked parent: upload a JPG, confirm the preview, save, reload and confirm it persists; replace it with a PNG; remove it and confirm the initials avatar returns.
- Confirm an oversized file and a PDF are refused before upload.
- Confirm a student ID from another family is refused by the upload and remove paths.
- Confirm the same photo appears on the admin student list and the teacher roster.
- Run typecheck and build and fix anything this change breaks.
