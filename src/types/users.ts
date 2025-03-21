export type UserRole = {
  isAdmin: boolean;
  isUser: boolean;
  isManager: boolean;
  isPartTime: boolean;  // mi-temps
  isCAT: boolean;       // CAT
};

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  password: string;
  roles: UserRole;
  hasValidatedPlanning: boolean;
}