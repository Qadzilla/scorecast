import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Background from "../components/Background";

describe("Background", () => {
  it("should render children", () => {
    render(
      <Background>
        <div data-testid="child">Test Child</div>
      </Background>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  it("should render without children", () => {
    const { container } = render(<Background />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("should have gradient background style", () => {
    const { container } = render(<Background />);
    const div = container.firstChild as HTMLElement;

    expect(div.style.background).toContain("linear-gradient");
  });

  it("should have min-h-screen class", () => {
    const { container } = render(<Background />);
    const div = container.firstChild as HTMLElement;

    expect(div).toHaveClass("min-h-screen");
  });
});
