import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { db } from "./db.js";
import leaguesRouter from "./routes/leagues.js";
import fixturesRouter from "./routes/fixtures.js";
import predictionsRouter from "./routes/predictions.js";
import leaderboardRouter from "./routes/leaderboard.js";
import adminRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";

export const app = express();

// CORS - only allow requests from your frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));

// General rate limit - 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

// Auth rate limit - 100 requests per 15 minutes (high for testing, reduce in production)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

app.use(generalLimiter);

const authHandler = toNodeHandler(auth);

// Better-auth handler - must check URL manually due to Express 5 routing issues
app.use(async (req, res, next) => {
  if (req.url.startsWith("/api/auth")) {
    // Handle username login - convert username to email before auth handler
    if (req.url.includes("/sign-in/email") && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      await new Promise<void>((resolve) => {
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            // If email field doesn't contain @, treat it as username
            if (data.email && !data.email.includes("@")) {
              const username = data.email.toLowerCase();
              const user = db.prepare(
                "SELECT email FROM user WHERE username = ?"
              ).get(username) as { email: string } | undefined;

              if (user) {
                data.email = user.email;
              }
              // If user not found, let it proceed - auth will return "user not found"
            }
            // Reconstruct the body for the auth handler
            const newBody = JSON.stringify(data);
            (req as any).body = data;
            (req as any).rawBody = newBody;
            // Override the read stream
            const { Readable } = require("stream");
            const readable = Readable.from([newBody]);
            (req as any)._readableState = readable._readableState;
            (req as any).read = readable.read.bind(readable);
            req.headers["content-length"] = Buffer.byteLength(newBody).toString();
          } catch {
            // If JSON parse fails, let it proceed as-is
          }
          resolve();
        });
      });
    }

    authLimiter(req, res, async () => {
      await authHandler(req, res);
    });
    return;
  }
  next();
});

// JSON body parser for API routes
app.use(express.json());

// API routes
app.use("/api/leagues", leaguesRouter);
app.use("/api/fixtures", fixturesRouter);
app.use("/api/predictions", predictionsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
