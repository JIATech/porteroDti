/**
 * Email validation
 * @param email Email string to validate
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password validation - Requires at least 8 characters, one uppercase, one lowercase and one number
 * @param password Password string to validate
 * @returns Boolean indicating if password is valid
 */
export const isValidPassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Phone number validation (simple version)
 * @param phone Phone number to validate
 * @returns Boolean indicating if phone number is valid
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Checks if a string is empty (null, undefined, or just whitespace)
 * @param value String to check
 * @returns Boolean indicating if string is empty
 */
export const isEmpty = (value?: string): boolean => {
  return value === undefined || value === null || value.trim() === '';
};
