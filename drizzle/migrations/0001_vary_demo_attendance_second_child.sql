UPDATE public.attendance a
SET status = (CASE
    WHEN EXTRACT(DOY FROM a.date)::int % 11 = 0 THEN 'absent'
    WHEN EXTRACT(DOY FROM a.date)::int % 9 = 0 THEN 'late'
    WHEN EXTRACT(DOY FROM a.date)::int % 37 = 0 THEN 'left_early'
    ELSE 'present'
  END)::public.attendance_status
FROM public.students s
WHERE s.id = a.student_id AND s.gr_number = '202600146';