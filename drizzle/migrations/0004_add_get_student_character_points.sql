CREATE OR REPLACE FUNCTION public.get_student_character_points(_student_id uuid)
RETURNS TABLE(
  id uuid,
  points integer,
  reason text,
  awarded_on date,
  teacher_id uuid,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id,
         cp.points,
         cp.reason,
         cp.awarded_on,
         cp.teacher_id,
         COALESCE(p.full_name, 'Teacher') AS teacher_name
  FROM public.character_points cp
  LEFT JOIN public.teachers t ON t.id = cp.teacher_id
  LEFT JOIN public.profiles p ON p.id = t.profile_id
  WHERE cp.student_id = _student_id
    AND (
      public.is_admin()
      OR public.is_parent_of_student(_student_id)
      OR public.teaches_student(_student_id)
    )
  ORDER BY cp.awarded_on DESC, cp.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_student_character_points(uuid) TO authenticated;
