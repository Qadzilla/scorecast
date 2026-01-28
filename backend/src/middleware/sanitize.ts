import type { Request, Response, NextFunction } from "express";

// Sanitize string by removing potentially dangerous characters
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML/script injection
    .trim();
}

// Validate and sanitize auth request bodies
export function sanitizeAuthInput(req: Request, res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== "object") {
    return next();
  }

  const body = req.body as Record<string, unknown>;

  // Validate email length
  if (body.email && typeof body.email === "string") {
    if (body.email.length > 254) { // RFC 5321 max email length
      res.status(400).json({ error: "Email too long" });
      return;
    }
  }

  // Validate and sanitize name
  if (body.name && typeof body.name === "string") {
    if (body.name.length > 100) {
      res.status(400).json({ error: "Name too long" });
      return;
    }
    body.name = sanitizeString(body.name);
  }

  // Validate password length (max)
  if (body.password && typeof body.password === "string") {
    if (body.password.length > 128) {
      res.status(400).json({ error: "Password too long" });
      return;
    }
  }

  next();
}
