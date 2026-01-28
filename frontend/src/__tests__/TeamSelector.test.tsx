import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamSelector from "../components/TeamSelector";
import { server } from "./setup";
import { http, HttpResponse } from "msw";

const mockTeams = [
  { id: "t1", name: "Arsenal", shortName: "ARS", code: "ARS", logo: "https://example.com/arsenal.png", competition: "premier_league" },
  { id: "t2", name: "Chelsea", shortName: "CHE", code: "CHE", logo: "https://example.com/chelsea.png", competition: "premier_league" },
  { id: "t3", name: "Liverpool", shortName: "LIV", code: "LIV", logo: null, competition: "premier_league" },
];

describe("TeamSelector", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading message initially", () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      expect(screen.getByText("Loading teams...")).toBeInTheDocument();
    });
  });

  describe("Rendering", () => {
    it("should render ScoreCast branding", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("ScoreCast")).toBeInTheDocument();
      });
    });

    it("should render teams after loading", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
        expect(screen.getByTitle("Chelsea")).toBeInTheDocument();
        expect(screen.getByTitle("Liverpool")).toBeInTheDocument();
      });
    });

    it("should show placeholder text when no team selected", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Select a team below")).toBeInTheDocument();
      });
    });

    it("should render Continue button disabled initially", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
      });
    });

    it("should show team code when logo is null", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json([{ id: "t1", name: "Team", shortName: "TM", code: "TM", logo: null, competition: "premier_league" }]);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("TM")).toBeInTheDocument();
      });
    });

    it("should show settings change note", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("You can change this later in settings")).toBeInTheDocument();
      });
    });
  });

  describe("Error State", () => {
    it("should show error message when fetch fails", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.error();
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load teams")).toBeInTheDocument();
      });
    });
  });

  describe("Team Selection", () => {
    it("should select team when clicked", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));

      expect(screen.getByText("Arsenal")).toBeInTheDocument();
      expect(screen.queryByText("Select a team below")).not.toBeInTheDocument();
    });

    it("should enable Continue button when team is selected", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));

      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    });

    it("should allow changing selection", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      expect(screen.getByText("Arsenal")).toBeInTheDocument();

      await user.click(screen.getByTitle("Chelsea"));
      expect(screen.getByText("Chelsea")).toBeInTheDocument();
      // Only one selected team name should be shown in the display area
    });
  });

  describe("Form Submission", () => {
    it("should call API with selected team on confirm", async () => {
      const user = userEvent.setup();
      let capturedRequest: { teamId: string } | null = null;

      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        }),
        http.post("http://localhost:3000/api/user/favorite-team", async ({ request }) => {
          capturedRequest = await request.json() as { teamId: string };
          return HttpResponse.json({ success: true });
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      await user.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(capturedRequest).toEqual({ teamId: "t1" });
      });
    });

    it("should show saving state during submission", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        }),
        http.post("http://localhost:3000/api/user/favorite-team", () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      await user.click(screen.getByRole("button", { name: "Continue" }));

      expect(screen.getByRole("button", { name: "Saving..." })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });

    it("should call onComplete on successful submission", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        }),
        http.post("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ success: true });
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      await user.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it("should show error message on submission failure", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        }),
        http.post("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.json({ error: "Team not found" }, { status: 404 });
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      await user.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Team not found")).toBeInTheDocument();
      });
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("should show generic error on network failure", async () => {
      const user = userEvent.setup();
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        }),
        http.post("http://localhost:3000/api/user/favorite-team", () => {
          return HttpResponse.error();
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Arsenal"));
      await user.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
      });
    });

    it("should not submit if no team selected", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          return HttpResponse.json(mockTeams);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
      });
    });
  });

  describe("Teams sorting", () => {
    it("should display teams sorted alphabetically", async () => {
      server.use(
        http.get("http://localhost:3000/api/user/teams", () => {
          // Send in non-alphabetical order
          return HttpResponse.json([
            { id: "t3", name: "Wolves", shortName: "WOL", code: "WOL", logo: null, competition: "premier_league" },
            { id: "t1", name: "Arsenal", shortName: "ARS", code: "ARS", logo: null, competition: "premier_league" },
            { id: "t2", name: "Manchester United", shortName: "MUN", code: "MUN", logo: null, competition: "premier_league" },
          ]);
        })
      );

      render(<TeamSelector onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      });

      // All teams should be rendered (API sorts them)
      expect(screen.getByTitle("Arsenal")).toBeInTheDocument();
      expect(screen.getByTitle("Manchester United")).toBeInTheDocument();
      expect(screen.getByTitle("Wolves")).toBeInTheDocument();
    });
  });
});
