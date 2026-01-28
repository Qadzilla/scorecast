import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../components/Dashboard";
import { server } from "./setup";
import { http, HttpResponse } from "msw";

// Mock auth module
vi.mock("../lib/auth", () => ({
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      },
    },
    isPending: false,
    error: null,
  })),
}));

// Mock the entire API module to avoid conflicts with MSW
vi.mock("../lib/api", () => ({
  fixturesApi: {
    getCurrentGameweek: vi.fn().mockResolvedValue({
      id: "gw-1",
      number: 1,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      startsAt: new Date(Date.now() + 90000000).toISOString(),
      endsAt: new Date(Date.now() + 180000000).toISOString(),
      status: "upcoming",
    }),
    getGameweek: vi.fn().mockResolvedValue({
      id: "gw-1",
      number: 1,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      startsAt: new Date(Date.now() + 90000000).toISOString(),
      endsAt: new Date(Date.now() + 180000000).toISOString(),
      status: "upcoming",
      matchdays: [],
    }),
  },
  predictionsApi: {
    getPredictions: vi.fn().mockResolvedValue([]),
    submitPredictions: vi.fn().mockResolvedValue({ success: true }),
  },
  leaderboardApi: {
    getLeaderboard: vi.fn().mockResolvedValue({
      entries: [],
      isSeasonComplete: false,
      champion: null,
    }),
  },
}));

import { signOut } from "../lib/auth";

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default MSW handlers
    server.use(
      http.get("http://localhost:3000/api/leagues", () => {
        return HttpResponse.json([]);
      }),
      http.get("http://localhost:3000/api/user/favorite-team", () => {
        return HttpResponse.json({ favoriteTeamId: null, team: null });
      })
    );
  });

  describe("Header", () => {
    it("should render ScoreCast branding", async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("ScoreCast")).toBeInTheDocument();
      });
    });

    it("should display username in header", async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("testuser")).toBeInTheDocument();
      });
    });

    it("should display user avatar with first initial when no team logo", async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("T")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate to Account when clicked", async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Account")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Account"));

      await waitFor(() => {
        expect(screen.getByText("Account Settings")).toBeInTheDocument();
      });
    });

    it("should call signOut when Log Out clicked", async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Log Out")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Log Out"));

      expect(signOut).toHaveBeenCalled();
    });
  });

  describe("My Leagues View", () => {
    it("should show loading state initially", () => {
      render(<Dashboard />);

      expect(screen.getByText("Loading leagues...")).toBeInTheDocument();
    });

    it("should show empty state when no leagues", async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("You haven't joined any leagues yet.")).toBeInTheDocument();
      });
    });
  });

  // Join League View tests are complex due to multiple "Join League" elements
  // The core functionality is tested through integration tests

  describe("Account View", () => {
    it("should render account settings", async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Account")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Account"));

      await waitFor(() => {
        expect(screen.getByText("Account Settings")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.getByText("Account Information")).toBeInTheDocument();
      });
    });

    it("should display user information", async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Account")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Account"));

      await waitFor(() => {
        expect(screen.getByText("test@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("Countdown Timers", () => {
    it("should show deadline timers section", async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Next Deadlines")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle leagues fetch error gracefully", async () => {
      server.use(
        http.get("http://localhost:3000/api/leagues", () => {
          return HttpResponse.error();
        })
      );

      render(<Dashboard />);

      // Should not crash, loading should complete
      await waitFor(() => {
        expect(screen.queryByText("Loading leagues...")).not.toBeInTheDocument();
      });
    });
  });
});
