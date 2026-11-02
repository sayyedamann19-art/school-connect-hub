-- Additive only: do not infer historical joining dates from account timestamps.
ALTER TABLE public.teachers
  ADD COLUMN joining_date date,
  ADD COLUMN educational_qualification text
    CHECK (char_length(educational_qualification) <= 200);
--> statement-breakpoint
-- Setting the default separately leaves every existing teacher's date NULL.
ALTER TABLE public.teachers
  ALTER COLUMN joining_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date);
