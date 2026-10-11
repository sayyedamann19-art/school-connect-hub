CREATE TABLE public.login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_time ON public.login_attempts (key, created_at DESC);
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only the backend account function (service role) reads or writes failed sign-in attempts.
COMMENT ON TABLE public.login_attempts IS 'Failed parent GR sign-in attempts for rate limiting; backend-only.';