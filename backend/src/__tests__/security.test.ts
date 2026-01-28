import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("Security Tests", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  describe("SQL Injection Prevention", () => {
    it("should reject SQL injection in email field", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "'; DROP TABLE user; --",
          password: "password123",
        })
        .set("Content-Type", "application/json");

      // Should fail due to invalid email format or user not found
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject SQL injection in password field", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "test@example.com",
          password: "' OR '1'='1",
        })
        .set("Content-Type", "application/json");

      // Should fail due to user not found or invalid credentials
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject UNION-based SQL injection", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "' UNION SELECT * FROM user --",
          password: "password123",
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("XSS Prevention", () => {
    it("should handle XSS attempts in name field", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "<script>alert('xss')</script>",
          email: `xss-test-${Date.now()}@example.com`,
          password: "SecurePassword123!",
          firstName: "<script>alert('xss')</script>",
          lastName: "Test",
          username: `xsstest_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      // Should either reject or sanitize - not execute
      if (response.status === 200 && response.body.user) {
        expect(response.body.user.name).not.toContain("<script>");
        expect(response.body.user.firstName).not.toContain("<script>");
      }
    });

    it("should handle XSS in email field", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "Test User",
          email: "<script>alert('xss')</script>@example.com",
          password: "SecurePassword123!",
          firstName: "Test",
          lastName: "User",
          username: `xssemail_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Input Validation", () => {
    it("should reject extremely long email", async () => {
      const longEmail = "a".repeat(10000) + "@example.com";
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "Test User",
          email: longEmail,
          password: "SecurePassword123!",
          firstName: "Test",
          lastName: "User",
          username: `longemail_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject extremely long password", async () => {
      const longPassword = "a".repeat(10000);
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "Test User",
          email: `longpass-${Date.now()}@example.com`,
          password: longPassword,
          firstName: "Test",
          lastName: "User",
          username: `longpass_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject extremely long name", async () => {
      const longName = "a".repeat(10000);
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: longName,
          email: `longname-${Date.now()}@example.com`,
          password: "SecurePassword123!",
          firstName: longName,
          lastName: "User",
          username: `longname_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle null bytes in input", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "test\x00@example.com",
          password: "password\x00injection",
        })
        .set("Content-Type", "application/json");

      // Should handle gracefully - either reject or process without vulnerability
      expect([200, 400, 401, 403, 422]).toContain(response.status);
    });

    it("should handle unicode overflow attempts", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "\uFFFF".repeat(100),
          email: `unicode-${Date.now()}@example.com`,
          password: "SecurePassword123!",
          firstName: "\uFFFF".repeat(10),
          lastName: "User",
          username: `unicode_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      // Should handle gracefully
      expect([200, 400, 422, 500]).toContain(response.status);
    });
  });

  describe("Malformed Request Handling", () => {
    it("should reject empty body", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({})
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: "test@example.com" })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Authentication Bypass Attempts", () => {
    it("should reject prototype pollution attempt", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "test@example.com",
          password: "password123",
          "__proto__": { isAdmin: true },
        })
        .set("Content-Type", "application/json");

      // Should not authenticate - either 4xx error or no session
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject constructor pollution attempt", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "test@example.com",
          password: "password123",
          "constructor": { prototype: { isAdmin: true } },
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should not allow role escalation via signup", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "Hacker",
          email: `hacker-${Date.now()}@example.com`,
          password: "SecurePassword123!",
          firstName: "Hacker",
          lastName: "Test",
          username: `hacker_${Date.now()}`,
          role: "admin",
          isAdmin: true,
          permissions: ["admin", "superuser"],
        })
        .set("Content-Type", "application/json");

      if (response.status === 200 && response.body.user) {
        expect(response.body.user.role).not.toBe("admin");
        expect(response.body.user.isAdmin).not.toBe(true);
      }
    });
  });

  describe("Session Security", () => {
    it("should not accept forged session tokens", async () => {
      const response = await request(app)
        .get("/api/auth/session")
        .set("Cookie", "pl-predictions.session_token=forged-token-12345")
        .set("Content-Type", "application/json");

      // Should not return a valid session with forged token
      if (response.status === 200) {
        expect(response.body.session).toBeNull();
      }
    });

    it("should not accept JWT-style forged tokens", async () => {
      const forgedJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsInJvbGUiOiJhZG1pbiJ9.fake";
      const response = await request(app)
        .get("/api/auth/session")
        .set("Cookie", `pl-predictions.session_token=${forgedJWT}`)
        .set("Content-Type", "application/json");

      if (response.status === 200) {
        expect(response.body.session).toBeNull();
      }
    });
  });

  describe("Header Injection", () => {
    it("should handle malicious headers", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "test@example.com",
          password: "password123",
        })
        .set("Content-Type", "application/json")
        .set("X-Forwarded-For", "127.0.0.1, <script>alert(1)</script>")
        .set("User-Agent", "<script>alert('xss')</script>");

      // Should not crash or expose vulnerabilities
      expect([200, 400, 401, 403, 422]).toContain(response.status);
    });
  });

  describe("Path Traversal", () => {
    it("should not allow path traversal in auth endpoints", async () => {
      const response = await request(app)
        .get("/api/auth/../../etc/passwd")
        .set("Content-Type", "application/json");

      expect(response.status).not.toBe(200);
    });

    it("should not allow encoded path traversal", async () => {
      const response = await request(app)
        .get("/api/auth/%2e%2e%2f%2e%2e%2fetc/passwd")
        .set("Content-Type", "application/json");

      expect(response.status).not.toBe(200);
    });
  });

  describe("Rate Limiting Awareness", () => {
    it("should handle rapid successive requests gracefully", async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post("/api/auth/sign-in/email")
          .send({
            email: "test@example.com",
            password: "wrong-password",
          })
          .set("Content-Type", "application/json")
      );

      const responses = await Promise.all(requests);

      // All should return error status (not crash)
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });
  });
});
