import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { queryOne } from "./db.js";
import leaguesRouter from "./routes/leagues.js";
import fixturesRouter from "./routes/fixtures.js";
import predictionsRouter from "./routes/predictions.js";
import leaderboardRouter from "./routes/leaderboard.js";
import adminRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";

export const app = express();

// Trust proxy (Railway, Vercel, etc. use reverse proxies)
app.set('trust proxy', 1);

// Health check — registered before the rate limiters so platform probes
// are never throttled and never count against a shared IP's budget
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// CORS - allow requests from configured origins
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Rate limits are keyed per IP, and mobile carriers put many users behind
// shared CGNAT IPs — so these are abuse backstops, not per-user fairness.
// The auth limiter covers ALL of /api/auth/* including frequent get-session
// calls, hence higher than a classic credential-guessing limit.
// Skipped under test unless TEST_ENABLE_RATE_LIMIT=true (see hygiene.test.ts).
const skipRateLimit = () =>
  process.env.NODE_ENV === "test" && process.env.TEST_ENABLE_RATE_LIMIT !== "true";

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: skipRateLimit,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later" },
  skip: skipRateLimit,
});

app.use(generalLimiter);

// Custom endpoint to lookup email by username for login
app.use(express.json({ limit: "10kb" }));

app.post("/api/auth/lookup-email", authLimiter, async (req, res) => {
  const { identifier } = req.body;

  if (!identifier || typeof identifier !== "string") {
    res.status(400).json({ error: "Identifier is required" });
    return;
  }

  const trimmedIdentifier = identifier.trim().toLowerCase();

  // If it looks like an email, return it directly
  if (trimmedIdentifier.includes("@")) {
    res.json({ email: trimmedIdentifier });
    return;
  }

  try {
    // Otherwise, look up the user by username
    const user = await queryOne<{ email: string }>(
      `SELECT email FROM "user" WHERE LOWER(username) = $1`,
      [trimmedIdentifier]
    );

    if (!user) {
      // Don't reveal whether username exists - return generic error
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.json({ email: user.email });
  } catch (err) {
    console.error("Failed to lookup email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const authHandler = toNodeHandler(auth);

// Better-auth handler - must check URL manually due to Express 5 routing issues
app.use(async (req, res, next) => {
  if (req.url.startsWith("/api/auth")) {
    authLimiter(req, res, async () => {
      try {
        await authHandler(req, res);
      } catch (error) {
        console.error("Auth handler error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });
    return;
  }
  next();
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
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
