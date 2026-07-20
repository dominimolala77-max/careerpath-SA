
-- Enums
CREATE TYPE public.institution_type AS ENUM ('university', 'tvet', 'nsfas');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'free', 'pending');
CREATE TYPE public.profile_status AS ENUM ('draft', 'submitted', 'processing', 'completed');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  id_number TEXT,
  email TEXT,
  phone TEXT,
  province TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  aps_score INTEGER,
  preferred_field TEXT,
  quiz_answers JSONB,
  status public.profile_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile access" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subjects" ON public.subjects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own documents" ON public.documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- institutions (public read)
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.institution_type NOT NULL,
  province TEXT,
  min_aps INTEGER,
  application_fee_cents INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  closing_date DATE,
  website TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO anon, authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institutions readable" ON public.institutions FOR SELECT TO anon, authenticated USING (true);

-- applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  yoco_charge_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own applications" ON public.applications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updates (dashboard messages)
CREATE TABLE public.updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.updates TO authenticated;
GRANT ALL ON public.updates TO service_role;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own updates" ON public.updates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed institutions
INSERT INTO public.institutions (name, type, province, min_aps, application_fee_cents, is_free, closing_date, description) VALUES
  ('NSFAS (National Student Financial Aid Scheme)', 'nsfas', NULL, NULL, 0, true, '2026-01-31', 'Government funding for tertiary studies. No application fee.'),
  ('University of Cape Town', 'university', 'Western Cape', 34, 10000, false, '2026-07-31', 'Top-ranked research university in Cape Town.'),
  ('University of the Witwatersrand', 'university', 'Gauteng', 34, 10000, false, '2026-09-30', 'Leading research university in Johannesburg.'),
  ('University of Johannesburg', 'university', 'Gauteng', 30, 20000, false, '2026-09-30', 'Comprehensive urban university.'),
  ('University of Pretoria', 'university', 'Gauteng', 32, 30000, false, '2026-06-30', 'Large research-intensive university.'),
  ('Stellenbosch University', 'university', 'Western Cape', 34, 10000, false, '2026-07-31', 'Historic university in the Cape Winelands.'),
  ('University of KwaZulu-Natal', 'university', 'KwaZulu-Natal', 28, 21000, false, '2026-09-30', 'Multi-campus research university.'),
  ('Nelson Mandela University', 'university', 'Eastern Cape', 26, 0, true, '2026-09-30', 'Application fee waived for 2026.'),
  ('Tshwane University of Technology', 'university', 'Gauteng', 22, 24000, false, '2026-09-30', 'University of Technology in Pretoria.'),
  ('False Bay TVET College', 'tvet', 'Western Cape', NULL, 0, true, '2026-11-30', 'Free application. Multiple Cape Town campuses.'),
  ('Ekurhuleni East TVET College', 'tvet', 'Gauteng', NULL, 0, true, '2026-11-30', 'Free application.'),
  ('Boland TVET College', 'tvet', 'Western Cape', NULL, 0, true, '2026-11-30', 'Free application.'),
  ('Umgungundlovu TVET College', 'tvet', 'KwaZulu-Natal', NULL, 0, true, '2026-11-30', 'Free application.');
