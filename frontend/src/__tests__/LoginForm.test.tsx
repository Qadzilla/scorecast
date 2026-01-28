import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../components/LoginForm";

// Mock the auth module
vi.mock("../lib/auth", () => ({
  signIn: {
    email: vi.fn(),
  },
}));

import { signIn } from "../lib/auth";

describe("LoginForm", () => {
  const mockOnSwitch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render login form", () => {
      render(<LoginForm onSwitch={mockOnSwitch} />);

      expect(screen.getByText("Sign in")).toBeInTheDocument();
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Username or email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    });

    it("should render ScoreCast branding", () => {
      render(<LoginForm onSwitch={mockOnSwitch} />);

      expect(screen.getAllByText("ScoreCast").length).toBeGreaterThan(0);
    });

    it("should render sign up link", () => {
      render(<LoginForm onSwitch={mockOnSwitch} />);

      expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
    });

    it("should show verified message when verified prop is true", () => {
      render(<LoginForm onSwitch={mockOnSwitch} verified={true} />);

      expect(screen.getByText(/Your account has been verified/)).toBeInTheDocument();
    });
  });

  describe("Form Interaction", () => {
    it("should update identifier field on input", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      const input = screen.getByPlaceholderText("Username or email");
      await user.type(input, "test@example.com");

      expect(input).toHaveValue("test@example.com");
    });

    it("should update password field on input", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      const input = screen.getByPlaceholderText("Password");
      await user.type(input, "password123");

      expect(input).toHaveValue("password123");
    });

    it("should call onSwitch when Sign Up button clicked", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.click(screen.getByRole("button", { name: "Sign Up" }));

      expect(mockOnSwitch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validation", () => {
    it("should show error when submitting empty form", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(screen.getByText("Username or email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });

    it("should show error when only email is provided", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(screen.queryByText("Username or email is required")).not.toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });

    it("should show error when only password is provided", async () => {
      const user = userEvent.setup();
      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(screen.getByText("Username or email is required")).toBeInTheDocument();
      expect(screen.queryByText("Password is required")).not.toBeInTheDocument();
    });

    it("should not show validation errors before submission", async () => {
      render(<LoginForm onSwitch={mockOnSwitch} />);

      expect(screen.queryByText("Username or email is required")).not.toBeInTheDocument();
      expect(screen.queryByText("Password is required")).not.toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call signIn.email with correct credentials", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockResolvedValue({ data: { user: { id: "1" } }, error: null });

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(signIn.email).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("should show loading state during submission", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(screen.getByRole("button", { name: "Signing In..." })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Signing In..." })).toBeDisabled();
    });

    it("should show error message on invalid credentials", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockResolvedValue({
        data: null,
        error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS", status: 401 },
      });

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid username or password")).toBeInTheDocument();
      });
    });

    it("should show rate limit message on 429 error", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockResolvedValue({
        data: null,
        error: { message: "Too many requests", code: "RATE_LIMITED", status: 429 },
      });

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.getByText(/Too many attempts/)).toBeInTheDocument();
      });
    });

    it("should show generic error on unexpected failure", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockRejectedValue(new Error("Network error"));

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
      });
    });

    it("should trim identifier before submission", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockResolvedValue({ data: { user: { id: "1" } }, error: null });

      render(<LoginForm onSwitch={mockOnSwitch} />);

      await user.type(screen.getByPlaceholderText("Username or email"), "  test@example.com  ");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      expect(signIn.email).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  describe("Verified Message", () => {
    it("should hide verified message after form submission", async () => {
      const user = userEvent.setup();
      vi.mocked(signIn.email).mockResolvedValue({ data: { user: { id: "1" } }, error: null });

      render(<LoginForm onSwitch={mockOnSwitch} verified={true} />);

      expect(screen.getByText(/Your account has been verified/)).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText("Username or email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.queryByText(/Your account has been verified/)).not.toBeInTheDocument();
      });
    });
  });
});
