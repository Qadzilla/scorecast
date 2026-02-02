import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { queryOne } from "./db.js";
import leaguesRouter from "./routes/leagues.js";
import fixturesRouter from "./routes/fixtures.js";
import predictionsRouter from "./routes/predictions.js";
import leaderboardRouter from "./routes/leaderboard.js";
import adminRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Trust proxy (Railway, Vercel, etc. use reverse proxies)
app.set('trust proxy', 1);

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

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}
