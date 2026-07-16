import { z } from "zod";

// Limits mirror the backend (auth.ts create.before hook + web validation.ts).
export const LIMITS = {
  EMAIL_MAX: 254,
  NAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
} as const;

// Login accepts either a username or an email in one field.
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginValues = z.infer<typeof loginSchema>;

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(LIMITS.EMAIL_MAX, `Email must be under ${LIMITS.EMAIL_MAX} characters`)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address");

const password = z
  .string()
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
  .max(LIMITS.PASSWORD_MAX, `Password must be under ${LIMITS.PASSWORD_MAX} characters`);

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(LIMITS.NAME_MAX, `${label} must be under ${LIMITS.NAME_MAX} characters`)
    .refine((v) => !/[<>]/.test(v), `${label} contains invalid characters`);

const username = z
  .string()
  .trim()
  .min(LIMITS.USERNAME_MIN, `Username must be at least ${LIMITS.USERNAME_MIN} characters`)
  .max(LIMITS.USERNAME_MAX, `Username must be under ${LIMITS.USERNAME_MAX} characters`)
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only");

// Signup (used in MS10). confirmPassword equality checked via refine.
export const signupSchema = z
  .object({
    firstName: name("First name"),
    lastName: name("Last name"),
    username,
    email,
    password,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupValues = z.infer<typeof signupSchema>;

export const usernameSchema = z.object({ username });
