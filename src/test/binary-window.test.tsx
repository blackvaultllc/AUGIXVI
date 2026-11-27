import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BinaryWindow } from "@/avatar/BinaryWindow";

describe("the binary window — his page for the code", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("teaches the two states and the places, right to left", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    expect(screen.getByText(/0 is off\. 1 is on\./)).toBeInTheDocument();
    expect(screen.getByText(/1, 2, 4, 8, 16, 32, 64, 128/)).toBeInTheDocument();
  });

  it("builds a byte by tapping bits and reads the sum aloud", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    // Starts on H: 01001000 = 64 + 8 = 72.
    expect(screen.getByText(/64 \+ 8 = 72/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter H/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place 1, bit 0" }));
    expect(screen.getByText(/64 \+ 8 \+ 1 = 73/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter I/)).toBeInTheDocument();
  });

  it("translates both ways, live", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Binary in/), {
      target: { value: "01001000 01101001" },
    });
    expect(screen.getByLabelText("Translated letters")).toHaveTextContent("Hi");
    fireEvent.change(screen.getByLabelText(/Letters in/), { target: { value: "Hi" } });
    expect(screen.getByLabelText("Translated binary")).toHaveTextContent("01001000 01101001");
  });

  it("counts 0 to 20 the slow way and keeps the number apart from the typed character", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    expect(screen.getByText(/16, 8, 4, 2, 1/)).toBeInTheDocument();
    expect(screen.getByText(/5 = 4 \+ 1 = 101/)).toBeInTheDocument();
    expect(screen.getByText(/17 = 16 \+ 1 = 10001/)).toBeInTheDocument();
    expect(screen.getByText("16 + 4 = 20")).toBeInTheDocument();
    // The difference, labeled plainly: number 5 is 101; character '5' is 00110101.
    expect(screen.getByText(/the number 5 by itself is/)).toBeInTheDocument();
    expect(screen.getByText(/0011 \+ the digit's own binary/)).toBeInTheDocument();
    expect(screen.getByText(/010 \+ the letter's number/)).toBeInTheDocument();
  });

  it("carries the full chart — space, numbers, A–Z, a–z — and a tap loads the byte", () => {
    render(<BinaryWindow onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /space, number 32, binary 00100000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /0, number 48, binary 00110000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Z, number 90, binary 01011010/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /z, number 122, binary 01111010/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A, number 65, binary 01000001/ }));
    expect(screen.getByText(/64 \+ 1 = 65/)).toBeInTheDocument();
    expect(screen.getByText(/that byte is the letter A/)).toBeInTheDocument();
  });
});
