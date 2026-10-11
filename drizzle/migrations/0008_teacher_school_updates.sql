CREATE POLICY school_updates_teacher_select_own ON public.school_updates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());
CREATE POLICY school_updates_teacher_insert_own ON public.school_updates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());
CREATE POLICY school_updates_teacher_update_own ON public.school_updates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());
CREATE POLICY school_updates_teacher_delete_own ON public.school_updates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());