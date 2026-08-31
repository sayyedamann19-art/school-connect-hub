-- Profiles for the new demo accounts (login_alias needed for parent GR login)
INSERT INTO public.profiles (id, full_name, phone, login_alias) VALUES
  ('eaa70097-d67f-415c-b625-a115a4784b1c', 'Priya Nair', '9820044556', NULL),
  ('a8abb4e2-3074-498b-93a5-8f8442dc29b0', 'Rehana Sayyed', '9820011223', 'parent.9820011223@parents.schoolconnect.app')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, login_alias = EXCLUDED.login_alias;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('eaa70097-d67f-415c-b625-a115a4784b1c', 'teacher'),
  ('a8abb4e2-3074-498b-93a5-8f8442dc29b0', 'parent'),
  ('9bfc5e05-28ab-477c-bae1-4e78593d7377', 'parent')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.teachers (profile_id, employee_code) VALUES
  ('eaa70097-d67f-415c-b625-a115a4784b1c', 'T002')
ON CONFLICT DO NOTHING;

INSERT INTO public.classes (id, name, division, academic_year) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Grade 5', 'A', '2026-2027')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.class_teachers (class_id, teacher_id, subject, is_class_teacher)
SELECT '11111111-1111-4111-8111-111111111111', t.id, 'Class Teacher', true
FROM public.teachers t WHERE t.employee_code IN ('T001','T002')
ON CONFLICT DO NOTHING;

INSERT INTO public.students (id, full_name, class_id, roll_number, gr_number, date_of_birth, height_cm, weight_kg) VALUES
  ('22222222-2222-4222-8222-222222222221', 'Ayaan Sayyed', '11111111-1111-4111-8111-111111111111', '12', '202600145', '2016-04-11', 132.5, 29.4),
  ('22222222-2222-4222-8222-222222222222', 'Zoya Sayyed', '11111111-1111-4111-8111-111111111111', '13', '202600146', '2018-09-02', 118.0, 22.1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parent_students (parent_id, student_id, relationship) VALUES
  ('a8abb4e2-3074-498b-93a5-8f8442dc29b0', '22222222-2222-4222-8222-222222222221', 'mother'),
  ('a8abb4e2-3074-498b-93a5-8f8442dc29b0', '22222222-2222-4222-8222-222222222222', 'mother'),
  ('9bfc5e05-28ab-477c-bae1-4e78593d7377', '22222222-2222-4222-8222-222222222221', 'father'),
  ('9bfc5e05-28ab-477c-bae1-4e78593d7377', '22222222-2222-4222-8222-222222222222', 'father')
ON CONFLICT DO NOTHING;