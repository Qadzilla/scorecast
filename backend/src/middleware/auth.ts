import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as AuthenticatedRequest).user = session.user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
