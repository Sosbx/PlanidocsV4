-- Mise à jour de la structure des rôles pour les utilisateurs existants
DO $$
BEGIN
  -- Ajouter la colonne roles si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'roles') THEN
    
    ALTER TABLE users 
    ADD COLUMN roles jsonb DEFAULT jsonb_build_object(
      'isAdmin', false,
      'isUser', true
    );

    -- Mettre à jour les rôles pour les utilisateurs existants
    UPDATE users 
    SET roles = jsonb_build_object(
      'isAdmin', CASE WHEN role = 'admin' THEN true ELSE false END,
      'isUser', true
    );
  END IF;
END $$;

-- Mettre à jour l'administrateur par défaut
UPDATE users 
SET roles = jsonb_build_object(
  'isAdmin', true,
  'isUser', true
)
WHERE id = '00000000-0000-0000-0000-000000000000';