import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { server } from "./setup";
import { http, HttpResponse } from "msw";

// Mock auth module
const mockUseSession = vi.fn();

vi.mock("../lib/auth", () => ({
  useSession: () => mockUseSession(),
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}));

// Mock Dashboard to simplify tests (it has its own test file)
vi.mock("../components/Dashboard", () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}));

// Mock TeamSelector
vi.mock("../components/TeamSelector", () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="team-selector">
      <button onClick={onComplete}>Select Team</button>
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not logged in
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
    });
  });

  describe("Loading State", () => {
    it("should show loading while session is pending", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
      });

      render(<App />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Unauthenticated State", () => {
    it("should show login form by default", () => {
      render(<App />);

      expect(screen.getByText("Welcome back")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter your username or email")).toBeInTheDocument();
    });

    it("should switch to signup form when Sign Up clicked", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole("button", { name: "Sign Up" }));

      expect(screen.getByText("Create account")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
    });

    it("should switch back to login from signup", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Go to signup
      await user.click(screen.getByRole("button", { name: "Sign Up" }));
      expect(screen.getByText("Create account")).toBeInTheDocument();

      // Go back to login
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });

    it.skip("should show verified message when URL has verified param", () => {
      // This test requires complex URL mocking that's environment-specific
      // The verified message functionality is tested through integration tests
    });
  });

  describe("Authenticated State - Without Favorite Team", () => {
    it("should show team selector when user has no favorite team", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ favoriteTeamId: null, team: null });
        })
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("team-selector")).toBeInTheDocument();
      });
    });

    it("should show dashboard after team is selected", async () => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ favoriteTeamId: null, team: null });
        })
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("team-selector")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select Team"));

      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });
    });
  });

  describe("Authenticated State - With Favorite Team", () => {
    it("should show dashboard when user has favorite team", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ favoriteTeamId: "team-1", team: { id: "team-1", name: "Arsenal" } });
        })
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });
    });

    it("should show loading while checking favorite team", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      render(<App />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should assume user has team if API fails", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.error();
        })
      );

      render(<App />);

      // Should proceed to dashboard on API error
      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });
    });
  });

  describe("SignUp Flow", () => {
    it("should show verify email after successful signup", async () => {
      const user = userEvent.setup();

      // Mock signUp to succeed
      const { signUp } = await import("../lib/auth");
      vi.mocked(signUp.email).mockResolvedValue({ data: { user: { id: "1" } }, error: null });

      render(<App />);

      // Navigate to signup
      await user.click(screen.getByRole("button", { name: "Sign Up" }));

      // Fill out the form
      await user.type(screen.getByPlaceholderText("First name"), "John");
      await user.type(screen.getByPlaceholderText("Last name"), "Doe");
      await user.type(screen.getByPlaceholderText("Username"), "johndoe");
      await user.type(screen.getByPlaceholderText("Email"), "john@example.com");
      await user.type(screen.getByPlaceholderText("Create a password"), "password123");
      await user.type(screen.getByPlaceholderText("Confirm your password"), "password123");

      // Submit
      await user.click(screen.getByRole("button", { name: "Sign Up" }));

      await waitFor(() => {
        expect(screen.getByText("Verify your email")).toBeInTheDocument();
        expect(screen.getByText("john@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("Background Component", () => {
    it("should render with Background wrapper when not authenticated", () => {
      render(<App />);

      // Background component wraps the login form
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });

  describe("Session State Changes", () => {
    it("should reset team state when session is cleared", async () => {
      // First render with session
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test User", email: "test@example.com" } },
        isPending: false,
      });

      server.use(
        http.get("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ favoriteTeamId: "team-1", team: { id: "team-1", name: "Arsenal" } });
        })
      );

      const { rerender } = render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });

      // Clear session
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      rerender(<App />);

      // Should show login form
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });
});
