import { useState, useMemo } from "react";
import { signUp } from "../lib/auth";
import {
  validateEmail,
  validatePassword,
  validateFirstName,
  validateLastName,
  validateUsername,
  validateConfirmPassword,
  type FieldError,
} from "../lib/validation";

interface FieldErrors {
  firstName: FieldError;
  lastName: FieldError;
  username: FieldError;
  email: FieldError;
  password: FieldError;
  confirmPassword: FieldError;
}

export default function SignUpForm({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: (email: string) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Real-time validation
  const errors: FieldErrors = useMemo(() => ({
    firstName: validateFirstName(firstName).error,
    lastName: validateLastName(lastName).error,
    username: validateUsername(username).error,
    email: validateEmail(email).error,
    password: validatePassword(password).error,
    confirmPassword: validateConfirmPassword(password, confirmPassword).error,
  }), [firstName, lastName, username, email, password, confirmPassword]);

  const isFormValid = useMemo(() => {
    return !errors.firstName && !errors.lastName && !errors.username && !errors.email && !errors.password && !errors.confirmPassword;
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSubmitted(true);

    if (!isFormValid) {
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        username: username.toLowerCase(),
      });

      if (result.error) {
        const error = result.error;
        const message = error.message || error.code || "";
        const status = error.status;

        // Handle specific error cases
        if (status === 429 || message.toLowerCase().includes("too many")) {
          setServerError("RATE_LIMITED");
        } else if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("already registered") || message.toLowerCase().includes("user_already_exists")) {
          setServerError("USER_EXISTS");
        } else {
          setServerError(message || "Failed to sign up. Please try again.");
        }
      } else {
        onSuccess(email);
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">ScoreCast</h1>
            <p className="text-white/70">Premier League & UCL prediction leagues</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  {serverError === "USER_EXISTS" ? (
                    <>
                      An account with this email already exists.{" "}
                      <button onClick={onSwitch} className="underline hover:no-underline">
                        Try logging in
                      </button>
                    </>
                  ) : serverError === "RATE_LIMITED" ? (
                    "Too many attempts. Please wait 15 minutes before trying again."
                  ) : (
                    serverError
                  )}
                </div>
              )}

              {/* Name fields - side by side */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={getInputClassName("firstName")}
                  />
                  {submitted && errors.firstName && (
                    <p className="mt-1 text-red-400 text-xs">{errors.firstName}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={getInputClassName("lastName")}
                  />
                  {submitted && errors.lastName && (
                    <p className="mt-1 text-red-400 text-xs">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Username field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={getInputClassName("username")}
                />
                {submitted && errors.username && (
                  <p className="mt-1 text-red-400 text-xs">{errors.username}</p>
                )}
              </div>

              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={getInputClassName("email")}
                />
                {submitted && errors.email && (
                  <p className="mt-1 text-red-400 text-xs">{errors.email}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={getInputClassName("password")}
                />
                {submitted && errors.password && (
                  <p className="mt-1 text-red-400 text-xs">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password field */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={getInputClassName("confirmPassword")}
                />
                {submitted && errors.confirmPassword && (
                  <p className="mt-1 text-red-400 text-xs">{errors.confirmPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-white text-gray-900 font-semibold transition-all duration-300 hover:bg-white/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <p className="mt-6 text-center text-white/60 text-sm">
              Already have an account?{" "}
              <button onClick={onSwitch} className="text-white font-semibold hover:underline">
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
