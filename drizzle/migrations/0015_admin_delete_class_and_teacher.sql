ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_delete_class(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can do this';
  END IF;
  -- Row lock: concurrent student inserts/moves into this class wait on it.
  PERFORM 1 FROM public.classes WHERE id = _class_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.students WHERE class_id = _class_id) THEN
    RAISE EXCEPTION 'This class still has students. Move or remove them first.';
  END IF;
  -- Keep history: detach (not delete) results and notes.
  UPDATE public.academic_results SET class_id = NULL WHERE class_id = _class_id;
  UPDATE public.teacher_notes SET class_id = NULL WHERE class_id = _class_id;
  DELETE FROM public.class_teachers WHERE class_id = _class_id;
  DELETE FROM public.class_subjects WHERE class_id = _class_id;
  DELETE FROM public.classes WHERE id = _class_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_class(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_class(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_teacher(_teacher_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can do this';
  END IF;
  SELECT profile_id INTO _profile FROM public.teachers WHERE id = _teacher_id AND deleted_at IS NULL FOR UPDATE;
  IF _profile IS NULL THEN RAISE EXCEPTION 'Teacher not found'; END IF;
  IF _profile = auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own teacher access'; END IF;
  -- Keep the teacher row so notes/points keep their attribution.
  DELETE FROM public.class_teachers WHERE teacher_id = _teacher_id;
  UPDATE public.teachers SET is_active = false, deleted_at = now() WHERE id = _teacher_id;
  DELETE FROM public.user_roles WHERE user_id = _profile AND role = 'teacher';
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_teacher(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_teacher(uuid) TO authenticated;