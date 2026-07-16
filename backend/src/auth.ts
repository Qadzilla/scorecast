import { betterAuth, type User } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { pool, queryOne } from "./db.js";
import { sendEmail } from "./email.js";

// Custom URL scheme of the iOS app (see MOBILE_PLAN.md §4.1) — must be a
// trusted origin so better-auth accepts requests from the Expo auth client.
// Standalone/dev builds send Origin "scorecast://".
export const APP_SCHEME_ORIGIN = "scorecast://";

// Expo Go can't use a custom scheme, so its dev origin is "exp://<lan-ip>:<port>/--/".
// The @better-auth/expo server plugin only auto-trusts "exp://" when
// NODE_ENV==="development"; prod (Railway) doesn't, which 403'd the app in
// Expo Go. A bare "exp://" pattern matches any exp:// origin by prefix. This is
// safe on prod: browsers can't set the custom `expo-origin` header without a
// CORS preflight (blocked), and no real web origin starts with "exp://", so it
// doesn't widen CSRF surface. Remove once dev happens on standalone builds only.
const EXPO_GO_ORIGIN = "exp://";

const isProduction = process.env.NODE_ENV === "production";

// Parse CORS origins (comma-separated for multiple origins)
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map(o => o.trim());

// Use the first origin as the primary frontend URL
const frontendURL = corsOrigins[0];

// Branded OTP email — same visual family as the link-verification email.
// The code sits in a <span data-otp> so tests can extract it from the outbox.
function otpEmailHtml(firstName: string, otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">ScoreCast</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 32px 0;">Premier League &amp; UCL Predictions</p>

        <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; margin-bottom: 32px;">
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Hey ${firstName}!</h2>
          <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Enter this code in the ScoreCast app to verify your email address. It expires in 10 minutes.
          </p>

          <span data-otp style="display: inline-block; background: linear-gradient(135deg, #00ff87 0%, #60efff 100%); color: #1a1a2e; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 14px 24px 14px 32px; border-radius: 8px;">${otp}</span>
        </div>

        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  plugins: [
    expo(),
    // Mobile email verification: the app requests a 6-digit code and the
    // user types it in — no web redirect involved (MOBILE_PLAN.md §4.2).
    // The link-based flow below stays enabled in parallel for the web app
    // until decommission; a mobile signup may therefore receive both emails
    // during the transition (the link still works, so this is harmless).
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // seconds — 10 minutes
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "email-verification") {
          // Password reset / OTP sign-in are not offered anywhere yet
          return;
        }
        const user = await queryOne<{ firstName: string | null }>(
          `SELECT "firstName" FROM "user" WHERE email = $1`,
          [email]
        );
        await sendEmail(
          email,
          "Your ScoreCast verification code",
          otpEmailHtml(user?.firstName || "there", otp)
        );
      },
    }),
  ],
  trustedOrigins: [...corsOrigins, APP_SCHEME_ORIGIN, EXPO_GO_ORIGIN],
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
        unique: true,
      },
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    cookiePrefix: "pl-predictions",
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: isProduction,
          // Use "none" for cross-origin (Vercel frontend + Railway backend)
          // "none" requires secure: true
          sameSite: isProduction ? "none" : "lax",
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    callbackURL: frontendURL,
    sendVerificationEmail: async ({ user, url }: { user: User & { firstName?: string }; url: string }) => {
      const firstName = user.firstName || "there";
      // Replace or add callbackURL to redirect to frontend after verification (with verified flag).
      // Pass frontendURL as base so a relative url (e.g. from a script with no HTTP
      // request context) still parses instead of throwing ERR_INVALID_URL.
      const urlObj = new URL(url, frontendURL);
      urlObj.searchParams.set("callbackURL", `${frontendURL}?verified=true`);
      const verifyURL = urlObj.toString();
      await sendEmail(
        user.email,
        "Verify your ScoreCast account",
        `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">ScoreCast</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 32px 0;">Premier League & UCL Predictions</p>

        <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; margin-bottom: 32px;">
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Hey ${firstName}!</h2>
          <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Thanks for signing up. Please verify your email address to get started with your predictions.
          </p>

          <a href="${verifyURL}" style="display: inline-block; background: linear-gradient(135deg, #00ff87 0%, #60efff 100%); color: #1a1a2e; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
            Verify Email Address
          </a>
        </div>

        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      );
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const userData = user as User & {
            firstName?: string;
            lastName?: string;
            username?: string;
          };
          // Sanitize fields to prevent XSS
          if (userData.name) {
            userData.name = userData.name.replace(/[<>]/g, "").trim();
          }
          if (userData.firstName) {
            userData.firstName = userData.firstName.replace(/[<>]/g, "").trim();
          }
          if (userData.lastName) {
            userData.lastName = userData.lastName.replace(/[<>]/g, "").trim();
          }
          if (userData.username) {
            userData.username = userData.username.replace(/[<>]/g, "").trim().toLowerCase();
          }
          // Validate email length
          if (userData.email && userData.email.length > 254) {
            throw new Error("Email too long");
          }
          // Validate name lengths
          if (userData.firstName && userData.firstName.length > 50) {
            throw new Error("First name too long");
          }
          if (userData.lastName && userData.lastName.length > 50) {
            throw new Error("Last name too long");
          }
          // Validate username
          if (userData.username) {
            if (userData.username.length < 3 || userData.username.length > 30) {
              throw new Error("Username must be 3-30 characters");
            }
            if (!/^[a-z0-9_]+$/.test(userData.username)) {
              throw new Error("Username can only contain letters, numbers, and underscores");
            }
          }
          // Set the name field from firstName + lastName for compatibility
          if (userData.firstName && userData.lastName) {
            userData.name = `${userData.firstName} ${userData.lastName}`;
          }
          return { data: userData };
        },
      },
    },
  },
});
