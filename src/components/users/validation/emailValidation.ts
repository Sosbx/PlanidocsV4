export const validateEmail = (email: string): boolean => {
  return Boolean(email.match(/^[^@]+\.[^@]+@h24scm\.com$/));
};

export const validateEmails = (emails: string[]): {
  isValid: boolean;
  invalidEmails: string[];
} => {
  const invalidEmails = emails.filter(email => !validateEmail(email));
  return {
    isValid: invalidEmails.length === 0,
    invalidEmails
  };
};

export const checkDuplicates = (emails: string[]): {
  hasDuplicates: boolean;
  uniqueEmails: string[];
} => {
  const uniqueEmails = Array.from(new Set(emails));
  return {
    hasDuplicates: uniqueEmails.length !== emails.length,
    uniqueEmails
  };
};