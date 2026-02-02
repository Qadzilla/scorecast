import { useState, useMemo } from "react";
import { signIn } from "../lib/auth";
import type { FieldError } from "../lib/validation";

interface FieldErrors {
  identifier: FieldError;
  password: FieldError;
}

export default function LoginForm({ onSwitch, verified, onDemo }: { onSwitch: () => void; verified?: boolean; onDemo?: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showVerified, setShowVerified] = useState(verified);

  // Real-time validation
  const errors: FieldErrors = useMemo(() => ({
    identifier: identifier.trim() ? null : "Username or email is required",
    password: password ? null : "Password is required",
  }), [identifier, password]);

  const isFormValid = useMemo(() => {
    return !errors.identifier && !errors.password;
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSubmitted(true);
    setShowVerified(false);

    if (!isFormValid) {
      return;
    }

    setLoading(true);

    try {
      // First, resolve the identifier to an email (handles both username and email)
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const lookupRes = await fetch(`${apiUrl}/api/auth/lookup-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      if (!lookupRes.ok) {
        if (lookupRes.status === 429) {
          setServerError("RATE_LIMITED");
        } else {
          setServerError("Invalid username or password");
        }
        return;
      }

      const { email } = await lookupRes.json();

      // Now sign in with the resolved email
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        const error = result.error;
        const message = error.message || error.code || "";
        const status = error.status;

        if (status === 429 || message.toLowerCase().includes("too many")) {
          setServerError("RATE_LIMITED");
        } else {
          setServerError("Invalid username or password");
        }
      }
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getInputClassName = (field: keyof FieldErrors) => {
    const base = "w-full px-4 py-3 rounded-lg border text-white placeholder-white/50 focus:outline-none transition-colors bg-white/10";
    if (submitted && errors[field]) {
      return `${base} border-red-500/50 focus:border-red-500`;
    }
    if (submitted && !errors[field]) {
      return `${base} border-green-500/50 focus:border-green-500`;
    }
    return `${base} border-white/20 focus:border-white/50 focus:ring-2 focus:ring-white/20`;
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-white mb-4">ScoreCast</h1>
          <p className="text-white/80 text-xl mb-8">Premier League & UCL prediction leagues</p>
          <div className="flex justify-center gap-6 mb-8">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00ff87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15c-3 0-5-2-5-5V4h10v6c0 3-2 5-5 5zm0 0v4m0 0H9m3 0h3M7 4H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3" />
              </svg>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00ff87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00ff87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-white/60 text-sm">
            Compete with friends, predict match scores, and climb the leaderboard
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">ScoreCast</h1>
            <p className="text-white/70 text-sm sm:text-base">Premier League & UCL prediction leagues</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 sm:p-8 shadow-xl">
            <h2 className="text-2xl font-extrabold text-white mb-6 tracking-tight">Sign in</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {showVerified && (
                <div className="p-3 rounded-lg bg-white/20 border border-white/50 text-white text-sm">
                  Your account has been verified. Please sign in.
                </div>
              )}
              {serverError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  {serverError === "RATE_LIMITED"
                    ? "Too many attempts. Please wait 15 minutes before trying again."
                    : serverError}
                </div>
              )}

              {/* Username or Email field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  placeholder="Username or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={getInputClassName("identifier")}
                />
                {submitted && errors.identifier && (
                  <p className="mt-1 text-red-400 text-xs">{errors.identifier}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={getInputClassName("password")}
                />
                {submitted && errors.password && (
                  <p className="mt-1 text-red-400 text-xs">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-white text-gray-900 font-semibold transition-all duration-300 hover:bg-white/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-white/60 text-sm">
              Don't have an account?{" "}
              <button onClick={onSwitch} className="text-white font-semibold hover:underline">
                Sign Up
              </button>
            </p>
          </div>

          {/* Demo button */}
          {onDemo && (
            <button
              onClick={onDemo}
              className="fixed bottom-6 right-6 px-4 py-2 rounded-full bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Try Demo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
