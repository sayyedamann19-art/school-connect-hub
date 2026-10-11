CREATE OR REPLACE FUNCTION public.get_update_senders(_update_ids uuid[])
RETURNS TABLE(update_id uuid, sender_name text, sender_is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT u.id,
         CASE WHEN public.has_role(u.created_by, 'admin') THEN 'Admin'
              ELSE COALESCE(NULLIF(p.full_name, ''), 'Teacher') END,
         public.has_role(u.created_by, 'admin')
  FROM public.school_updates u
  LEFT JOIN public.profiles p ON p.id = u.created_by
  WHERE u.id = ANY(_update_ids)
    AND auth.uid() IS NOT NULL
    AND (u.is_published OR public.is_admin() OR u.created_by = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_update_senders(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_update_senders(uuid[]) TO authenticated;