-- Fungsi untuk pendaftaran user secara massal (Batch Registration) - Versi Perbaikan
-- Menghapus cast eksplisit ke public.app_role untuk menghindari eror "type does not exist"

CREATE OR REPLACE FUNCTION public.register_users_batch(p_users jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record jsonb;
BEGIN
  FOR user_record IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    -- Memanggil fungsi register_user yang sudah ada
    -- Role dilewatkan sebagai teks agar Postgres melakukan casting otomatis
    PERFORM public.register_user(
      (user_record->>'username'),
      (user_record->>'password'),
      (user_record->>'full_name'),
      (user_record->>'role'),
      (user_record->>'nim'),
      (user_record->>'assistant_code'),
      (user_record->>'division'),
      (user_record->>'phone_number'),
      (user_record->>'class_code'),
      (user_record->>'shift'),
      (user_record->>'is_active')::boolean
    );
  END LOOP;
END;
$$;
