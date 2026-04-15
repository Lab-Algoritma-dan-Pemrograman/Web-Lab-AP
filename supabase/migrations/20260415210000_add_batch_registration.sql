-- Fungsi untuk pendaftaran user secara massal (Batch Registration)
-- Fungsi ini akan memanggil `register_user` untuk setiap item guna memastikan hashing berjalan benar.

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
    PERFORM public.register_user(
      (user_record->>'username'),
      (user_record->>'password'),
      (user_record->>'full_name'),
      (user_record->>'role')::public.app_role,
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
