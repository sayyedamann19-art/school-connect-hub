CREATE OR REPLACE FUNCTION public.get_student_notes(_student_id uuid)
RETURNS TABLE (
  id uuid,
  note text,
  note_date date,
  subject text,
  teacher_id uuid,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id,
         n.note,
         n.note_date,
         n.subject,
         n.teacher_id,
         COALESCE(p.full_name, 'Teacher') AS teacher_name
  FROM public.teacher_notes n
  LEFT JOIN public.teachers t ON t.id = n.teacher_id
  LEFT JOIN public.profiles p ON p.id = t.profile_id
  WHERE n.student_id = _student_id
    AND (
      public.is_admin()
      OR public.is_parent_of_student(_student_id)
      OR public.teaches_student(_student_id)
    )
  ORDER BY n.note_date DESC, n.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_student_notes(uuid) TO authenticated;
