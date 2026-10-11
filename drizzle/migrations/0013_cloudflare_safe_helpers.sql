-- Parent photo upload without the privileged key: linked parents (or admins) may write only inside their child's folder.
CREATE POLICY student_photos_parent_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND public.is_parent_of_student(((storage.foldername(name))[2])::uuid)
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);
CREATE POLICY student_photos_parent_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND public.is_parent_of_student(((storage.foldername(name))[2])::uuid)
);
CREATE POLICY student_photos_parent_read_own_folder ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = 'students'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND public.is_parent_of_student(((storage.foldername(name))[2])::uuid)
);

-- Point a student at a photo (or clear it). Re-checks the relationship; path must sit in that student's folder.
CREATE OR REPLACE FUNCTION public.set_student_photo(_student_id uuid, _path text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _previous text;
BEGIN
  IF NOT (public.is_admin() OR public.is_parent_of_student(_student_id)) THEN
    RAISE EXCEPTION 'This student isn''t linked to your account';
  END IF;
  IF _path IS NOT NULL AND _path NOT LIKE 'students/' || _student_id::text || '/%' THEN
    RAISE EXCEPTION 'Invalid photo location';
  END IF;
  SELECT photo_path INTO _previous FROM public.students WHERE id = _student_id;
  UPDATE public.students SET photo_path = _path WHERE id = _student_id;
  RETURN _previous;
END $$;
REVOKE ALL ON FUNCTION public.set_student_photo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_student_photo(uuid, text) TO authenticated;

-- Importer duplicate-GR check: admins and teachers only; returns id, name and GR number.
CREATE OR REPLACE FUNCTION public.import_student_lookup()
RETURNS TABLE(id uuid, full_name text, gr_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.full_name, s.gr_number FROM public.students s
  WHERE public.is_admin() OR public.has_role(auth.uid(), 'teacher');
$$;
REVOKE ALL ON FUNCTION public.import_student_lookup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_student_lookup() TO authenticated;

-- Parent contacts for students the caller may manage (admin, or teacher of that student's class).
CREATE OR REPLACE FUNCTION public.get_student_parent_contacts(_student_ids uuid[])
RETURNS TABLE(student_id uuid, parent_id uuid, full_name text, phone text, relationship text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ps.student_id, ps.parent_id, p.full_name, p.phone, ps.relationship
  FROM public.parent_students ps
  LEFT JOIN public.profiles p ON p.id = ps.parent_id
  WHERE ps.student_id = ANY(_student_ids)
    AND (public.is_admin() OR public.teaches_student(ps.student_id))
  ORDER BY ps.created_at;
$$;
REVOKE ALL ON FUNCTION public.get_student_parent_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_parent_contacts(uuid[]) TO authenticated;

-- Parents linked to students in the calling teacher's classes (admins: all).
CREATE OR REPLACE FUNCTION public.list_my_class_parents()
RETURNS TABLE(parent_id uuid, full_name text, phone text, relationship text, student_id uuid, student_name text, gr_number text, roll_number text, class_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ps.parent_id, p.full_name, p.phone, ps.relationship, s.id, s.full_name, s.gr_number, s.roll_number,
         CASE WHEN c.id IS NULL THEN NULL ELSE c.name || COALESCE('-' || c.division, '') END
  FROM public.parent_students ps
  JOIN public.students s ON s.id = ps.student_id
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.profiles p ON p.id = ps.parent_id
  WHERE public.is_admin() OR public.teaches_student(s.id);
$$;
REVOKE ALL ON FUNCTION public.list_my_class_parents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_class_parents() TO authenticated;

-- Parent account suspension status for the admin Parents panel.
CREATE OR REPLACE FUNCTION public.admin_parent_account_status(_ids uuid[])
RETURNS TABLE(user_id uuid, is_suspended boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, COALESCE(u.banned_until > now(), false)
  FROM auth.users u
  WHERE u.id = ANY(_ids) AND public.is_admin();
$$;
REVOKE ALL ON FUNCTION public.admin_parent_account_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_parent_account_status(uuid[]) TO authenticated;