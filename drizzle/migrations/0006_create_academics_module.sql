CREATE TYPE public.academic_result_status AS ENUM ('present', 'absent', 'not_applicable');

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subjects_name_key ON public.subjects (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY subjects_select ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY subjects_admin_write ON public.subjects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.academic_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX academic_exams_year_name_key ON public.academic_exams (academic_year, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_exams TO authenticated;
GRANT ALL ON public.academic_exams TO service_role;
ALTER TABLE public.academic_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_exams_select ON public.academic_exams FOR SELECT TO authenticated USING (true);
CREATE POLICY academic_exams_admin_write ON public.academic_exams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_academic_exams_updated BEFORE UPDATE ON public.academic_exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.academic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.academic_exams(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  status public.academic_result_status NOT NULL DEFAULT 'present',
  marks_obtained numeric(6,2),
  maximum_marks numeric(6,2) NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_results_unique UNIQUE (student_id, exam_id, subject_id),
  CONSTRAINT academic_results_max_positive CHECK (maximum_marks > 0 AND maximum_marks <= 1000),
  CONSTRAINT academic_results_marks_range CHECK (marks_obtained IS NULL OR (marks_obtained >= 0 AND marks_obtained <= maximum_marks)),
  CONSTRAINT academic_results_marks_by_status CHECK (
    (status = 'present' AND marks_obtained IS NOT NULL) OR (status <> 'present' AND marks_obtained IS NULL)
  )
);
CREATE INDEX academic_results_exam_idx ON public.academic_results (exam_id);
CREATE INDEX academic_results_student_idx ON public.academic_results (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_results TO authenticated;
GRANT ALL ON public.academic_results TO service_role;
ALTER TABLE public.academic_results ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.exam_is_published(_exam_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.academic_exams WHERE id = _exam_id AND status = 'published');
$$;

CREATE POLICY academic_results_select ON public.academic_results FOR SELECT TO authenticated USING (
  public.is_admin()
  OR public.teaches_student(student_id)
  OR (public.is_parent_of_student(student_id) AND public.exam_is_published(exam_id))
);
CREATE POLICY academic_results_insert ON public.academic_results FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR (public.teaches_student(student_id) AND NOT public.exam_is_published(exam_id))
);
CREATE POLICY academic_results_update ON public.academic_results FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.teaches_student(student_id) AND NOT public.exam_is_published(exam_id)))
  WITH CHECK (public.is_admin() OR (public.teaches_student(student_id) AND NOT public.exam_is_published(exam_id)));
CREATE POLICY academic_results_delete ON public.academic_results FOR DELETE TO authenticated USING (
  public.is_admin() OR (public.teaches_student(student_id) AND NOT public.exam_is_published(exam_id))
);
CREATE TRIGGER trg_academic_results_updated BEFORE UPDATE ON public.academic_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.academic_exams (academic_year, name, display_order) VALUES
  ('2026-2027', '1st Unit Test', 1),
  ('2026-2027', 'Terminal Examination', 2),
  ('2026-2027', '2nd Unit Test', 3),
  ('2026-2027', 'Final Examination', 4);

INSERT INTO public.subjects (name, display_order) VALUES
  ('English', 1), ('Hindi', 2), ('Mathematics', 3), ('Science', 4), ('Social Science', 5);