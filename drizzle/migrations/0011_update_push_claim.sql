ALTER TABLE public.school_updates ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_update_push(_update_id uuid)
RETURNS TABLE(id uuid, title text, body text, category text)
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.school_updates u
     SET push_sent_at = now()
   WHERE u.id = _update_id
     AND u.is_published = true
     AND u.push_sent_at IS NULL
     AND (public.is_admin() OR u.created_by = auth.uid())
  RETURNING u.id, u.title, u.body, u.category;
$$;

REVOKE ALL ON FUNCTION public.claim_update_push(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_update_push(uuid) TO authenticated;

-- Updates already published before this change must never alert again.
UPDATE public.school_updates SET push_sent_at = COALESCE(first_published_at, now())
 WHERE first_published_at IS NOT NULL AND push_sent_at IS NULL;