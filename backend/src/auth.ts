import { betterAuth, type User } from "better-auth";
import { db } from "./db.js";
import { sendEmail } from "./email.js";

const isProduction = process.env.NODE_ENV === "production";

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: db,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5174"],
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
          sameSite: "lax",
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
    callbackURL: process.env.CORS_ORIGIN || "http://localhost:5173",
    sendVerificationEmail: async ({ user, url }: { user: User & { firstName?: string }; url: string }) => {
      const firstName = user.firstName || "there";
      const frontendURL = process.env.CORS_ORIGIN || "http://localhost:5173";
      // Replace or add callbackURL to redirect to frontend after verification (with verified flag)
      const urlObj = new URL(url);
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
