/**
 * Composant wrapper simple
 * Conservé uniquement pour la compatibilité avec App.tsx
 */
const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export default AuthRedirectHandler;