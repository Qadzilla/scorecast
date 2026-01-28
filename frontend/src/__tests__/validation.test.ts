import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateFirstName,
  validateLastName,
  validateUsername,
  validateConfirmPassword,
  LIMITS,
} from "../lib/validation";

describe("Validation Functions", () => {
  describe("validateEmail", () => {
    it("should return error for empty email", () => {
      const result = validateEmail("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Email is required");
    });

    it("should return error for invalid email format", () => {
      const result = validateEmail("notanemail");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please enter a valid email address");
    });

    it("should return error for email without domain", () => {
      const result = validateEmail("test@");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please enter a valid email address");
    });

    it("should return error for email without @", () => {
      const result = validateEmail("test.example.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please enter a valid email address");
    });

    it("should return error for too long email", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.EMAIL_MAX}`);
    });

    it("should pass for valid email", () => {
      const result = validateEmail("test@example.com");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for valid email with subdomain", () => {
      const result = validateEmail("test@mail.example.com");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validatePassword", () => {
    it("should return error for empty password", () => {
      const result = validatePassword("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Password is required");
    });

    it("should return error for too short password", () => {
      const result = validatePassword("short");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.PASSWORD_MIN}`);
    });

    it("should return error for too long password", () => {
      const result = validatePassword("a".repeat(130));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.PASSWORD_MAX}`);
    });

    it("should pass for valid password", () => {
      const result = validatePassword("SecurePass123!");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for minimum length password", () => {
      const result = validatePassword("a".repeat(LIMITS.PASSWORD_MIN));
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateFirstName", () => {
    it("should return error for empty first name", () => {
      const result = validateFirstName("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("First name is required");
    });

    it("should return error for too long first name", () => {
      const result = validateFirstName("a".repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.NAME_MAX}`);
    });

    it("should return error for XSS attempt", () => {
      const result = validateFirstName("<script>alert('xss')</script>");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("First name contains invalid characters");
    });

    it("should return error for HTML injection", () => {
      const result = validateFirstName("John<img src=x>");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("First name contains invalid characters");
    });

    it("should pass for valid first name", () => {
      const result = validateFirstName("John");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for name with spaces", () => {
      const result = validateFirstName("Mary Jane");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateLastName", () => {
    it("should return error for empty last name", () => {
      const result = validateLastName("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Last name is required");
    });

    it("should return error for too long last name", () => {
      const result = validateLastName("a".repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.NAME_MAX}`);
    });

    it("should return error for XSS attempt", () => {
      const result = validateLastName("<script>");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Last name contains invalid characters");
    });

    it("should pass for valid last name", () => {
      const result = validateLastName("Smith");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for hyphenated last name", () => {
      const result = validateLastName("Smith-Jones");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateUsername", () => {
    it("should return error for empty username", () => {
      const result = validateUsername("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username is required");
    });

    it("should return error for too short username", () => {
      const result = validateUsername("ab");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.USERNAME_MIN}`);
    });

    it("should return error for too long username", () => {
      const result = validateUsername("a".repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${LIMITS.USERNAME_MAX}`);
    });

    it("should return error for username with special characters", () => {
      const result = validateUsername("user@name");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username can only contain letters, numbers, and underscores");
    });

    it("should return error for username with spaces", () => {
      const result = validateUsername("user name");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username can only contain letters, numbers, and underscores");
    });

    it("should return error for username with dash", () => {
      const result = validateUsername("user-name");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username can only contain letters, numbers, and underscores");
    });

    it("should pass for valid username", () => {
      const result = validateUsername("john_doe");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for username with numbers", () => {
      const result = validateUsername("user123");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should pass for username with underscore", () => {
      const result = validateUsername("john_doe_123");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateConfirmPassword", () => {
    it("should return error for empty confirm password", () => {
      const result = validateConfirmPassword("password123", "");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please confirm your password");
    });

    it("should return error when passwords don't match", () => {
      const result = validateConfirmPassword("password123", "password456");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Passwords do not match");
    });

    it("should pass when passwords match", () => {
      const result = validateConfirmPassword("password123", "password123");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });
});
