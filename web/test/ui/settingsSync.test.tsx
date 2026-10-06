// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useHoursPerMonth } from "../../src/hooks/useSettings";

/** An editor and a reader of the same setting, as separate components. */
function Editor() {
  const [hours, setHours] = useHoursPerMonth();
  return (
    <button type="button" onClick={() => setHours(hours + 5)}>
      add five
    </button>
  );
}
function Reader({ label }: { label: string }) {
  const [hours] = useHoursPerMonth();
  return (
    <p>
      {label}: {hours}
    </p>
  );
}

describe("settings shared between components", () => {
  it("updates every component using a setting the moment one changes it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Editor />
        <Reader label="library" />
        <Reader label="plan" />
      </>,
    );
    expect(screen.getByText("library: 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "add five" }));

    expect(screen.getByText("library: 25")).toBeInTheDocument();
    expect(screen.getByText("plan: 25")).toBeInTheDocument();
  });

  it("starts from what was saved", () => {
    window.localStorage.setItem("stream-scheduler:hours-per-month", "40");
    render(<Reader label="library" />);
    expect(screen.getByText("library: 40")).toBeInTheDocument();
  });

  it("ignores a saved value out of range", () => {
    window.localStorage.setItem("stream-scheduler:hours-per-month", "9000");
    render(<Reader label="library" />);
    expect(screen.getByText("library: 20")).toBeInTheDocument();
  });
});
