import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("shows the error and retries on request", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error="The request failed" onRetry={onRetry} />);

    expect(screen.getByText("The request failed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});