-- Additive: existing students remain valid and existing RLS policies stay in place.
-- Apply before deploying code that reads or writes these columns.
ALTER TABLE public.students
  ADD COLUMN mother_name text CHECK (char_length(mother_name) <= 120),
  ADD COLUMN address text CHECK (char_length(address) <= 500),
  ADD COLUMN contact_number text CHECK (contact_number ~ '^[6-9][0-9]{9}$');
-- Age is calculated from date_of_birth on the current school date, never stored.
