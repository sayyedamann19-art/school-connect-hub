-- Students: GR number, height, weight
ALTER TABLE public.students
  ADD COLUMN gr_number text,
  ADD COLUMN height_cm numeric(5,2),
  ADD COLUMN weight_kg numeric(5,2);

UPDATE public.students SET gr_number = id::text WHERE gr_number IS NULL;

ALTER TABLE public.students ALTER COLUMN gr_number SET NOT NULL;
CREATE UNIQUE INDEX students_gr_number_key ON public.students (lower(gr_number));

-- Parent login alias on profile
ALTER TABLE public.profiles ADD COLUMN login_alias text;
CREATE UNIQUE INDEX profiles_login_alias_key ON public.profiles (login_alias);

-- Helper: can the current user edit this student?
CREATE OR REPLACE FUNCTION public.can_edit_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.teaches_student(_student_id);
$$;

REVOKE ALL ON FUNCTION public.can_edit_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_student(uuid) TO authenticated;

-- Teachers may update permitted student fields for their own students
CREATE POLICY students_teacher_update ON public.students
  FOR UPDATE TO authenticated
  USING (public.teaches_student(id))
  WITH CHECK (public.teaches_student(id));

-- GR number changes are admin-only
CREATE OR REPLACE FUNCTION public.guard_student_gr_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gr_number IS DISTINCT FROM OLD.gr_number AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change a GR number';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_student_gr_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_students_guard_gr_number
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.guard_student_gr_number();

-- Import history
CREATE TABLE public.student_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES public.profiles(id),
  file_name text,
  total_records integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.student_imports TO authenticated;
GRANT ALL ON public.student_imports TO service_role;

ALTER TABLE public.student_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_imports_select ON public.student_imports
  FOR SELECT TO authenticated
  USING (public.is_admin() OR uploaded_by = auth.uid());

CREATE POLICY student_imports_insert ON public.student_imports
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE TRIGGER trg_student_imports_updated
  BEFORE UPDATE ON public.student_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX student_imports_created_at_idx ON public.student_imports (created_at DESC);
CREATE INDEX students_class_idx ON public.students (class_id);