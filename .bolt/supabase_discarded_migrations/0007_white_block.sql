/*
  # Fix admin authentication setup

  This migration ensures the admin user is properly set up in both public.users and auth tables
  with correct provider_id for authentication.

  1. Changes
    - Set up admin in public.users table
    - Clean up existing auth entries
    - Create fresh admin auth user with proper metadata
    - Create admin identity with required provider_id
*/

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
  role = 'admin',
  email = 'admin@planego.com',
  password = 'ADMIN123';

-- Clean up any existing admin auth entries
DELETE FROM auth.users WHERE email = 'admin@planego.com';
DELETE FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Create fresh admin auth user
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
  raw_user_meta_data,
  is_super_admin,
  is_sso_user
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
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "admin"}',
  false,
  false
);

-- Create fresh admin identity with required provider_id
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'admin@planego.com',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000000',
    'email', 'admin@planego.com',
    'provider_id', 'admin@planego.com'
  ),
  'email',
  now(),
  now(),
  now()
);