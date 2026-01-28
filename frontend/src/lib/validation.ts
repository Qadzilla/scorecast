// Validation limits (must match backend)
export const LIMITS = {
  EMAIL_MAX: 254,
  NAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
} as const;

export type FieldError = string | null;

export interface ValidationResult {
  isValid: boolean;
  error: FieldError;
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: "Email is required" };
  }
  if (email.length > LIMITS.EMAIL_MAX) {
    return { isValid: false, error: `Email must be less than ${LIMITS.EMAIL_MAX} characters` };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }
  return { isValid: true, error: null };
}

// Password validation
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: "Password is required" };
  }
  if (password.length < LIMITS.PASSWORD_MIN) {
    return { isValid: false, error: `Password must be at least ${LIMITS.PASSWORD_MIN} characters` };
  }
  if (password.length > LIMITS.PASSWORD_MAX) {
    return { isValid: false, error: `Password must be less than ${LIMITS.PASSWORD_MAX} characters` };
  }
  return { isValid: true, error: null };
}

// First name validation
export function validateFirstName(firstName: string): ValidationResult {
  if (!firstName) {
    return { isValid: false, error: "First name is required" };
  }
  if (firstName.length > LIMITS.NAME_MAX) {
    return { isValid: false, error: `First name must be less than ${LIMITS.NAME_MAX} characters` };
  }
  if (/<|>/.test(firstName)) {
    return { isValid: false, error: "First name contains invalid characters" };
  }
  return { isValid: true, error: null };
}

// Last name validation
export function validateLastName(lastName: string): ValidationResult {
  if (!lastName) {
    return { isValid: false, error: "Last name is required" };
  }
  if (lastName.length > LIMITS.NAME_MAX) {
    return { isValid: false, error: `Last name must be less than ${LIMITS.NAME_MAX} characters` };
  }
  if (/<|>/.test(lastName)) {
    return { isValid: false, error: "Last name contains invalid characters" };
  }
  return { isValid: true, error: null };
}

// Username validation
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: "Username is required" };
  }
  if (username.length < LIMITS.USERNAME_MIN) {
    return { isValid: false, error: `Username must be at least ${LIMITS.USERNAME_MIN} characters` };
  }
  if (username.length > LIMITS.USERNAME_MAX) {
    return { isValid: false, error: `Username must be less than ${LIMITS.USERNAME_MAX} characters` };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, and underscores" };
  }
  return { isValid: true, error: null };
}

// Confirm password validation
export function validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword) {
    return { isValid: false, error: "Please confirm your password" };
  }
  if (password !== confirmPassword) {
    return { isValid: false, error: "Passwords do not match" };
  }
  return { isValid: true, error: null };
}
