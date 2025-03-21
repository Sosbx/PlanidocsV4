/*
  # Update user roles structure

  1. Changes
    - Add roles JSONB column to store multiple roles
    - Migrate existing role data to new structure
    - Update admin user with correct roles
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add roles column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'roles') THEN
    
    ALTER TABLE users 
    ADD COLUMN roles jsonb DEFAULT jsonb_build_object(
      'isAdmin', false,
      'isUser', true
    );

    -- Migrate existing role data to new structure
    UPDATE users 
    SET roles = jsonb_build_object(
      'isAdmin', CASE WHEN role = 'admin' THEN true ELSE false END,
      'isUser', CASE WHEN role = 'user' THEN true ELSE false END
    );
  END IF;
END $$;

-- Update admin user with correct roles
UPDATE users 
SET roles = jsonb_build_object(
  'isAdmin', true,
  'isUser', false
)
WHERE id = '00000000-0000-0000-0000-000000000000';