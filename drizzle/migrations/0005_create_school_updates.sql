CREATE TABLE IF NOT EXISTS public.school_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'notice' CHECK (category IN ('school','attendance','feedback','notice')),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_updates TO authenticated;
GRANT ALL ON public.school_updates TO service_role;

ALTER TABLE public.school_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_updates_admin_write ON public.school_updates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY school_updates_select ON public.school_updates
  FOR SELECT TO authenticated USING (public.is_admin() OR is_published);

CREATE TRIGGER trg_school_updates_updated BEFORE UPDATE ON public.school_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS school_updates_published_idx
  ON public.school_updates (is_published, published_at DESC);