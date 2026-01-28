import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Mock handlers for API requests
export const handlers = [
  // Auth handlers
  http.get("http://localhost:3000/api/auth/get-session", () => {
    return HttpResponse.json({ session: null, user: null });
  }),

  http.post("http://localhost:3000/api/auth/sign-in/email", async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === "test@example.com" && body.password === "password123") {
      return HttpResponse.json({
        user: { id: "1", email: "test@example.com", name: "Test User" },
        session: { token: "test-token" },
      });
    }
    return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }),

  http.post("http://localhost:3000/api/auth/sign-up/email", async ({ request }) => {
    const body = await request.json() as { email: string };
    if (body.email === "existing@example.com") {
      return HttpResponse.json({ error: "User already exists" }, { status: 400 });
    }
    return HttpResponse.json({
      user: { id: "1", email: body.email },
    });
  }),

  http.post("http://localhost:3000/api/auth/sign-out", () => {
    return HttpResponse.json({ success: true });
  }),

  // League handlers
  http.get("http://localhost:3000/api/leagues", () => {
    return HttpResponse.json([
      { id: "1", name: "Test League", type: "premier_league", role: "admin", memberCount: 5 },
      { id: "2", name: "Friends League", type: "champions_league", role: "member", memberCount: 3 },
    ]);
  }),

  http.post("http://localhost:3000/api/leagues", async ({ request }) => {
    const body = await request.json() as { name: string; type: string };
    return HttpResponse.json({
      id: "new-league-id",
      name: body.name,
      type: body.type,
      inviteCode: "ABC12345",
      role: "admin",
    }, { status: 201 });
  }),

  http.post("http://localhost:3000/api/leagues/join", async ({ request }) => {
    const body = await request.json() as { inviteCode: string };
    if (body.inviteCode === "INVALID") {
      return HttpResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }
    return HttpResponse.json({
      id: "joined-league-id",
      name: "Joined League",
      role: "member",
    });
  }),

  // Fixtures handlers
  http.get("http://localhost:3000/api/fixtures/gameweek/current/:competition", () => {
    return HttpResponse.json({
      id: "gw-1",
      number: 1,
      deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      status: "upcoming",
    });
  }),

  http.get("http://localhost:3000/api/fixtures/gameweek/:id", () => {
    return HttpResponse.json({
      id: "gw-1",
      number: 1,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      status: "upcoming",
      matchdays: [
        {
          id: "md-1",
          date: new Date().toISOString(),
          dayNumber: 1,
          matches: [
            {
              id: "match-1",
              kickoffTime: new Date(Date.now() + 86400000).toISOString(),
              homeScore: null,
              awayScore: null,
              status: "scheduled",
              homeTeam: { id: "t1", name: "Arsenal", shortName: "ARS", code: "ARS", logo: null },
              awayTeam: { id: "t2", name: "Chelsea", shortName: "CHE", code: "CHE", logo: null },
            },
          ],
        },
      ],
    });
  }),

  // User handlers
  http.get("http://localhost:3000/api/user/teams", () => {
    return HttpResponse.json([
      { id: "t1", name: "Arsenal", shortName: "ARS", logo: null, competition: "premier_league" },
      { id: "t2", name: "Chelsea", shortName: "CHE", logo: null, competition: "premier_league" },
      { id: "t3", name: "Liverpool", shortName: "LIV", logo: null, competition: "premier_league" },
    ]);
  }),

  http.get("http://localhost:3000/api/user/favorite-team", () => {
    return HttpResponse.json({ favoriteTeamId: null, team: null });
  }),

  http.post("http://localhost:3000/api/user/favorite-team", async ({ request }) => {
    const body = await request.json() as { teamId: string };
    return HttpResponse.json({
      success: true,
      team: { id: body.teamId, name: "Arsenal" },
    });
  }),

  // Leaderboard handlers
  http.get("http://localhost:3000/api/leaderboard/:leagueId", () => {
    return HttpResponse.json({
      entries: [
        { rank: 1, userId: "1", username: "user1", firstName: "John", lastName: "Doe", totalPoints: 50, exactScores: 5, correctResults: 20 },
        { rank: 2, userId: "2", username: "user2", firstName: "Jane", lastName: "Smith", totalPoints: 45, exactScores: 4, correctResults: 18 },
      ],
      isSeasonComplete: false,
      champion: null,
    });
  }),

  // Predictions handlers
  http.get("http://localhost:3000/api/predictions/:leagueId/gameweek/:gameweekId", () => {
    return HttpResponse.json([]);
  }),

  http.post("http://localhost:3000/api/predictions/:leagueId/gameweek/:gameweekId", () => {
    return HttpResponse.json({ success: true });
  }),
];

export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});
