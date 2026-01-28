import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VerifyEmail from "../components/VerifyEmail";

describe("VerifyEmail", () => {
  describe("Rendering", () => {
    it("should render ScoreCast branding", () => {
      render(<VerifyEmail email="test@example.com" />);

      expect(screen.getByText("ScoreCast")).toBeInTheDocument();
      expect(screen.getByText("Premier League & UCL prediction leagues")).toBeInTheDocument();
    });

    it("should render verification heading", () => {
      render(<VerifyEmail email="test@example.com" />);

      expect(screen.getByText("Verify your email")).toBeInTheDocument();
    });

    it("should display the user's email address", () => {
      render(<VerifyEmail email="user@domain.com" />);

      expect(screen.getByText("user@domain.com")).toBeInTheDocument();
    });

    it("should show verification instructions", () => {
      render(<VerifyEmail email="test@example.com" />);

      expect(screen.getByText("We've sent a verification link to")).toBeInTheDocument();
      expect(screen.getByText(/Click the link in the email to verify your account/)).toBeInTheDocument();
      expect(screen.getByText(/check your spam folder/)).toBeInTheDocument();
    });

    it("should render email icon", () => {
      const { container } = render(<VerifyEmail email="test@example.com" />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Different emails", () => {
    it("should display different email addresses correctly", () => {
      const { rerender } = render(<VerifyEmail email="first@test.com" />);
      expect(screen.getByText("first@test.com")).toBeInTheDocument();

      rerender(<VerifyEmail email="second@example.org" />);
      expect(screen.getByText("second@example.org")).toBeInTheDocument();
      expect(screen.queryByText("first@test.com")).not.toBeInTheDocument();
    });

    it("should handle email with special characters", () => {
      render(<VerifyEmail email="user+tag@subdomain.example.com" />);

      expect(screen.getByText("user+tag@subdomain.example.com")).toBeInTheDocument();
    });
  });
});
