import { useState, useEffect } from "react";
import { useSession } from "./lib/auth";
import Background from "./components/Background";
import LoginForm from "./components/LoginForm";
import SignUpForm from "./components/SignUpForm";
import VerifyEmail from "./components/VerifyEmail";
import Dashboard from "./components/Dashboard";
import TeamSelector from "./components/TeamSelector";

type AuthView = "login" | "signup" | "verify-email";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [view, setView] = useState<AuthView>("login");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [hasFavoriteTeam, setHasFavoriteTeam] = useState<boolean | null>(null);
  const [checkingTeam, setCheckingTeam] = useState(false);
  const { data: session, isPending } = useSession();

  // Check if user just verified their email
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("verified")) {
      setEmailVerified(true);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Clear verified message when session changes (user logs in or out)
  useEffect(() => {
    if (session) {
      setEmailVerified(false);
    }
  }, [session]);

  // Check if user has a favorite team
  useEffect(() => {
    if (session && hasFavoriteTeam === null && !checkingTeam) {
      setCheckingTeam(true);
      fetch(`${API_URL}/api/user/favorite-team`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          setHasFavoriteTeam(!!data.favoriteTeamId);
        })
        .catch(() => {
          // If error, assume they have a team so they can proceed
          setHasFavoriteTeam(true);
        })
        .finally(() => {
          setCheckingTeam(false);
        });
    }
  }, [session, hasFavoriteTeam, checkingTeam]);

  // Reset favorite team state when session changes
  useEffect(() => {
    if (!session) {
      setHasFavoriteTeam(null);
    }
  }, [session]);

  const handleSignUpSuccess = (email: string) => {
    setVerifyEmail(email);
    setView("verify-email");
  };

  const handleTeamSelected = () => {
    setHasFavoriteTeam(true);
  };

  if (isPending || (session && hasFavoriteTeam === null)) {
    return (
      <Background>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </Background>
    );
  }

  if (session) {
    // Show team selector if user hasn't selected a favorite team
    if (hasFavoriteTeam === false) {
      return <TeamSelector onComplete={handleTeamSelected} />;
    }
    return <Dashboard />;
  }

  return (
    <Background>
      {view === "login" && (
        <LoginForm onSwitch={() => setView("signup")} verified={emailVerified} />
      )}
      {view === "signup" && (
        <SignUpForm
          onSwitch={() => setView("login")}
          onSuccess={handleSignUpSuccess}
        />
      )}
      {view === "verify-email" && (
        <VerifyEmail email={verifyEmail} />
      )}
    </Background>
  );
}

export default App;
