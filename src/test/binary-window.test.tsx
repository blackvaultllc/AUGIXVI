import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BinaryWindow } from "@/avatar/BinaryWindow";

function openModule(title: string) {
  fireEvent.click(screen.getByRole("button", { name: (content) => content.includes(title) }));
}

describe("the binary window — the full learning program", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens on Foundations: the two states, and why two", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    expect(screen.getByText(/0 is off\. 1 is on\./)).toBeInTheDocument();
    expect(screen.getByText(/Why two states\?/)).toBeInTheDocument();
    expect(screen.getByText(/Modules learned: 0 of 14/)).toBeInTheDocument();
  });

  it("places module: build a byte by tapping bits and read the sum aloud", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    openModule("Place Values & Counting");
    expect(screen.getByText(/1, 2, 4, 8, 16, 32, 64, 128/)).toBeInTheDocument();
    expect(screen.getByText(/64 \+ 8 = 72/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter H/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place 1, bit 0" }));
    expect(screen.getByText(/64 \+ 8 \+ 1 = 73/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter I/)).toBeInTheDocument();
    // Counting chart + the whole byte range stand on the same page.
    expect(screen.getByText(/17 = 16 \+ 1 = 10001/)).toBeInTheDocument();
    expect(screen.getByText("255 · 11111111")).toBeInTheDocument();
  });

  it("characters module: the full chart, the 5 vs '5' difference, a tap loads the builder", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    openModule("Characters (ASCII)");
    expect(screen.getByText(/the number 5 by itself is/)).toBeInTheDocument();
    expect(screen.getByText(/0011 \+ the digit's own binary/)).toBeInTheDocument();
    expect(screen.getByText(/010 \+ the letter's number/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /space, number 32, binary 00100000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Z, number 90, binary 01011010/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /!, number 33, binary 00100001/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A, number 65, binary 01000001/ }));
    expect(screen.getByText(/64 \+ 1 = 65/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter A/)).toBeInTheDocument();
  });

  it("translator module: both ways, with the per-byte breakdown", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    openModule("The Translator");
    fireEvent.change(screen.getByLabelText(/Binary in/), {
      target: { value: "01001000 01101001" },
    });
    expect(screen.getByLabelText("Translated letters")).toHaveTextContent("Hi");
    const readings = [...document.querySelectorAll(".binary-window__readings li")].map(
      (li) => li.textContent ?? "",
    );
    expect(readings[0]).toContain("01001000 → 64 + 8 = 72 → 'H'");
    expect(readings[1]).toContain("01101001 → 64 + 32 + 8 + 1 = 105 → 'i'");
    fireEvent.change(screen.getByLabelText(/Letters in/), { target: { value: "Hi" } });
    expect(screen.getByLabelText("Translated binary")).toHaveTextContent("01001000 01101001");
  });

  it("a drill checks the answer and shows the working (floating point is a fixed question)", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    openModule("Floating Point");
    fireEvent.click(
      screen.getByRole("button", { name: /B — In binary, 0.1 is a fraction that repeats/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(screen.getByText(/Right\./)).toBeInTheDocument();
    expect(screen.getByText(/Modules learned: 1 of 14/)).toBeInTheDocument();
  });

  it("the mastery pass starts a ten-question run and the review lists every module", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    openModule("Practice & Mastery");
    expect(screen.getByText(/1\. Foundations —/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start the mastery pass/ }));
    expect(screen.getByText(/Question 1 of 10/)).toBeInTheDocument();
  });
});
