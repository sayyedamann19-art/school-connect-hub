CREATE TABLE public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  maximum_marks numeric NOT NULL DEFAULT 100 CHECK (maximum_marks > 0 AND maximum_marks <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class subjects readable by staff and linked parents" ON public.class_subjects
FOR SELECT TO authenticated USING (
  public.is_admin() OR public.teaches_class(class_id) OR EXISTS (
    SELECT 1 FROM public.students s WHERE s.class_id = class_subjects.class_id AND public.is_parent_of_student(s.id)
  )
);
CREATE POLICY "Class subjects insert by admin or class teacher" ON public.class_subjects
FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.teaches_class(class_id));
CREATE POLICY "Class subjects update by admin or class teacher" ON public.class_subjects
FOR UPDATE TO authenticated USING (public.is_admin() OR public.teaches_class(class_id))
WITH CHECK (public.is_admin() OR public.teaches_class(class_id));
CREATE POLICY "Class subjects delete by admin or class teacher" ON public.class_subjects
FOR DELETE TO authenticated USING (public.is_admin() OR public.teaches_class(class_id));