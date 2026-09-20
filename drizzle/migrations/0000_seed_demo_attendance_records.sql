INSERT INTO public.attendance (student_id, date, status)
SELECT s.id,
       d::date,
       (CASE
          WHEN (EXTRACT(DOY FROM d)::int + CASE WHEN s.gr_number = '202600145' THEN 0 ELSE 5 END) % 19 = 0 THEN 'absent'
          WHEN (EXTRACT(DOY FROM d)::int + CASE WHEN s.gr_number = '202600145' THEN 0 ELSE 5 END) % 13 = 0 THEN 'late'
          WHEN (EXTRACT(DOY FROM d)::int + CASE WHEN s.gr_number = '202600145' THEN 0 ELSE 5 END) % 29 = 0 THEN 'left_early'
          ELSE 'present'
        END)::public.attendance_status
FROM public.students s
CROSS JOIN generate_series('2026-04-01'::date, '2026-09-20'::date, interval '1 day') d
WHERE s.gr_number IN ('202600145', '202600146')
  AND EXTRACT(DOW FROM d) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance a WHERE a.student_id = s.id AND a.date = d::date
  );