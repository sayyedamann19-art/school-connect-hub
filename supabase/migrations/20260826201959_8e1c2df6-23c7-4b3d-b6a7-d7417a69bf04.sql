-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'left_early', 'other');

-- UPDATED AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- PROFILE AUTO CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLASSES
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  division TEXT,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, division, academic_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- TEACHERS
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- STUDENTS
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  roll_number TEXT,
  date_of_birth DATE,
  photo_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- CLASS TEACHERS
CREATE TABLE public.class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject TEXT,
  is_class_teacher BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, teacher_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- PARENT STUDENTS
CREATE TABLE public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'guardian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_students TO authenticated;
GRANT ALL ON public.parent_students TO service_role;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- ACCESS HELPERS
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_students
    WHERE student_id = _student_id AND parent_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.teaches_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.class_teachers ct ON ct.class_id = s.class_id
    JOIN public.teachers t ON t.id = ct.teacher_id
    WHERE s.id = _student_id AND t.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.teaches_class(_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers ct
    JOIN public.teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = _class_id AND t.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid();
$$;

-- ATTENDANCE
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- TEACHER NOTES
CREATE TABLE public.teacher_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject TEXT,
  note TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_notes TO authenticated;
GRANT ALL ON public.teacher_notes TO service_role;
ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;

-- CHARACTER POINTS
CREATE TABLE public.character_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  awarded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_points TO authenticated;
GRANT ALL ON public.character_points TO service_role;
ALTER TABLE public.character_points ENABLE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_parent_students_parent ON public.parent_students(parent_id);
CREATE INDEX idx_parent_students_student ON public.parent_students(student_id);
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date DESC);
CREATE INDEX idx_teacher_notes_student ON public.teacher_notes(student_id, note_date DESC);
CREATE INDEX idx_character_points_student ON public.character_points(student_id, awarded_on DESC);

-- UPDATED AT TRIGGERS
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_teacher_notes_updated BEFORE UPDATE ON public.teacher_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_character_points_updated BEFORE UPDATE ON public.character_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- POLICIES: PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- POLICIES: USER ROLES
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: CLASSES
CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated USING (
  public.is_admin() OR public.teaches_class(id) OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.class_id = classes.id AND public.is_parent_of_student(s.id)
  )
);
CREATE POLICY "classes_admin_write" ON public.classes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: TEACHERS
CREATE POLICY "teachers_select" ON public.teachers FOR SELECT TO authenticated USING (public.is_admin() OR profile_id = auth.uid());
CREATE POLICY "teachers_admin_write" ON public.teachers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: CLASS TEACHERS
CREATE POLICY "class_teachers_select" ON public.class_teachers FOR SELECT TO authenticated USING (public.is_admin() OR teacher_id = public.current_teacher_id());
CREATE POLICY "class_teachers_admin_write" ON public.class_teachers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: STUDENTS
CREATE POLICY "students_select" ON public.students FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_parent_of_student(id) OR public.teaches_student(id)
);
CREATE POLICY "students_admin_write" ON public.students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: PARENT STUDENTS (admin-only writes)
CREATE POLICY "parent_students_select" ON public.parent_students FOR SELECT TO authenticated USING (
  public.is_admin() OR parent_id = auth.uid() OR public.teaches_student(student_id)
);
CREATE POLICY "parent_students_admin_write" ON public.parent_students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: ATTENDANCE
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_parent_of_student(student_id) OR public.teaches_student(student_id)
);
CREATE POLICY "attendance_teacher_insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR public.teaches_student(student_id)
);
CREATE POLICY "attendance_teacher_update" ON public.attendance FOR UPDATE TO authenticated USING (
  public.is_admin() OR public.teaches_student(student_id)
) WITH CHECK (public.is_admin() OR public.teaches_student(student_id));
CREATE POLICY "attendance_admin_delete" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin());

-- POLICIES: TEACHER NOTES
CREATE POLICY "teacher_notes_select" ON public.teacher_notes FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_parent_of_student(student_id) OR public.teaches_student(student_id)
);
CREATE POLICY "teacher_notes_insert" ON public.teacher_notes FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR (public.teaches_student(student_id) AND teacher_id = public.current_teacher_id())
);
CREATE POLICY "teacher_notes_update_own" ON public.teacher_notes FOR UPDATE TO authenticated USING (
  public.is_admin() OR teacher_id = public.current_teacher_id()
) WITH CHECK (public.is_admin() OR teacher_id = public.current_teacher_id());
CREATE POLICY "teacher_notes_delete_own" ON public.teacher_notes FOR DELETE TO authenticated USING (
  public.is_admin() OR teacher_id = public.current_teacher_id()
);

-- POLICIES: CHARACTER POINTS
CREATE POLICY "character_points_select" ON public.character_points FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_parent_of_student(student_id) OR public.teaches_student(student_id)
);
CREATE POLICY "character_points_insert" ON public.character_points FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR (public.teaches_student(student_id) AND teacher_id = public.current_teacher_id())
);
CREATE POLICY "character_points_update_own" ON public.character_points FOR UPDATE TO authenticated USING (
  public.is_admin() OR teacher_id = public.current_teacher_id()
) WITH CHECK (public.is_admin() OR teacher_id = public.current_teacher_id());
CREATE POLICY "character_points_delete_own" ON public.character_points FOR DELETE TO authenticated USING (
  public.is_admin() OR teacher_id = public.current_teacher_id()
);

-- STORAGE POLICIES (bucket: student-photos)
CREATE POLICY "student_photos_read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'student-photos' AND (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.photo_path = storage.objects.name
        AND (public.is_parent_of_student(s.id) OR public.teaches_student(s.id))
    )
  )
);
CREATE POLICY "student_photos_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'student-photos' AND public.is_admin()
);
CREATE POLICY "student_photos_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'student-photos' AND public.is_admin()
);
CREATE POLICY "student_photos_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'student-photos' AND public.is_admin()
);