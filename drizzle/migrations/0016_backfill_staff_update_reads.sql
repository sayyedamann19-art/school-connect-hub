INSERT INTO public.update_reads (user_id, update_id)
SELECT r.user_id, u.id
FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','teacher')) r
CROSS JOIN public.school_updates u
WHERE u.is_published
ON CONFLICT DO NOTHING;