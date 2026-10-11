ALTER TABLE public.school_updates DROP CONSTRAINT IF EXISTS school_updates_category_check;
ALTER TABLE public.school_updates ADD CONSTRAINT school_updates_category_check
  CHECK (category IN ('notice','holiday','school','attendance','feedback'));
COMMENT ON COLUMN public.school_updates.category IS 'notice or holiday. Legacy values school/attendance/feedback are kept on old rows and shown as notice.';

ALTER TABLE public.school_updates ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
UPDATE public.school_updates SET first_published_at = COALESCE(published_at, created_at)
  WHERE is_published AND first_published_at IS NULL;

CREATE OR REPLACE FUNCTION public.stamp_first_published()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_published AND NEW.first_published_at IS NULL THEN
    NEW.first_published_at = now();
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.first_published_at = COALESCE(OLD.first_published_at, NEW.first_published_at);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_school_updates_first_published BEFORE INSERT OR UPDATE ON public.school_updates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_first_published();

CREATE TABLE public.update_reads (
  user_id uuid NOT NULL,
  update_id uuid NOT NULL REFERENCES public.school_updates(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, update_id)
);
GRANT SELECT, INSERT, DELETE ON public.update_reads TO authenticated;
GRANT ALL ON public.update_reads TO service_role;
ALTER TABLE public.update_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY update_reads_own_select ON public.update_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY update_reads_own_insert ON public.update_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY update_reads_own_delete ON public.update_reads FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_updates boolean NOT NULL DEFAULT true;