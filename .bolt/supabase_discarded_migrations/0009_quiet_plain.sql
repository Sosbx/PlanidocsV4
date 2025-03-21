/*
  # Fix admin authentication setup

  1. Changes
    - Clean up existing admin entries
    - Create admin user with minimal required fields
    - Set up proper RLS policies
    - Ensure consistent state across auth and public tables
*/

-- First clean up any existing admin entries
DELETE FROM auth.users WHERE email = 'admin@planego.com';
DELETE FROM auth.identities WHERE provider_id = 'admin@planego.com';

-- Create admin user in auth.users with minimal required fields
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  aud,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'admin@planego.com',
  crypt('ADMIN123', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated',
  now(),
  now(),
  now(),
  jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  ),
  jsonb_build_object(
    'role', 'admin'
  )
);

-- Create admin identity
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'admin@planego.com',
  'email',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000000',
    'email', 'admin@planego.com',
    'provider_id', 'admin@planego.com'
  ),
  now(),
  now(),
  now()
);

-- Ensure admin exists in public.users
INSERT INTO public.users (
  id,
  first_name,
  last_name,
  email,
  login,
  password,
  role,
  has_validated_planning
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Admin',
  'System',
  'admin@planego.com',
  'ADMIN',
  'ADMIN123',
  'admin',
  true
) ON CONFLICT (id) DO UPDATE SET
  email = 'admin@planego.com',
  password = 'ADMIN123',
  role = 'admin';

-- Update RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin has full access" ON public.users;
DROP POLICY IF EXISTS "Users can read all users" ON public.users;

CREATE POLICY "Admin has full access"
  ON public.users
  FOR ALL 
  TO authenticated
  USING (
    auth.uid() = '00000000-0000-0000-0000-000000000000'
    OR (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users au 
      WHERE au.id = auth.uid() 
      AND (au.raw_user_meta_data->>'role')::text = 'admin'
    ))
  )
  WITH CHECK (
    auth.uid() = '00000000-0000-0000-0000-000000000000'
    OR (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users au 
      WHERE au.id = auth.uid() 
      AND (au.raw_user_meta_data->>'role')::text = 'admin'
    ))
  );

CREATE POLICY "Users can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);