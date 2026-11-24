import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteCodesWindow } from "@/avatar/RemoteCodesWindow";
import type { RfDevice, RfIndex, RfSetupListData } from "@/avatar/remoteCodes";

/**
 * REMOTE CODES WINDOW (owner order 2026-11-24): the RF/IR knowledge
 * load on a screen — find a code by brand/model, see it on a remote
 * surface, copy it; setup numbers by list and brand; help in plain
 * words with the sources named. The fetch layer is stubbed with a
 * fixture shaped exactly like the ingest output.
 */

const index: RfIndex = {
  generatedAt: "2026-11-24T00:00:00.000Z",
  sources: [
    { id: "flipper-irdb", name: "Flipper IRDB", detail: "Community IR database", stats: { codes: 100 } },
    { id: "irdb", name: "irdb", detail: "Protocol database", stats: { codes: 50 } },
  ],
  totals: { devices: 2, codes: 150, brands: 1 },
  categories: [{ id: "tv", label: "TVs", devices: 2, brands: ["Samsung"] }],
  brandIndex: { Samsung: [{ category: "tv", devices: 2 }] },
  setupLists: [
    {
      id: "smpl-2019",
      name: "SMPL remote code list (2019-1)",
      detail: "Setup numbers for SMPL remotes",
      categories: { tv: { label: "TVs", brands: ["Samsung"] } },
    },
  ],
};

const devices: RfDevice[] = [
  {
    brand: "Samsung",
    model: "TV 7,7",
    category: "tv",
    sources: ["irdb"],
    buttons: [
      { name: "POWER", codes: [{ protocol: "NECx2", address: "07 07", command: "02", sources: ["irdb"] }] },
      {
        name: "VOLUME +",
        codes: [{ raw: "8885 4455 547 1667", frequency: 38381, sources: ["flipper-irdb"] }],
      },
    ],
  },
];

const setup: RfSetupListData = {
  id: "smpl-2019",
  categories: { tv: { Samsung: ["423", "422", "413"] } },
};

function stubFetch() {
  const fetchFn = vi.fn(async (url: string) => {
    const body = url.endsWith("index.json")
      ? index
      : url.includes("devices-tv--samsung")
        ? devices
        : url.includes("setup-smpl-2019")
          ? setup
          : null;
    return { ok: body !== null, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchFn);
  return fetchFn;
}

describe("Remote Codes window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    stubFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("walks brand → model → remote → code, with the source named", async () => {
    render(<RemoteCodesWindow onClose={vi.fn()} />);
    const brandBtn = await screen.findByRole("button", { name: /Samsung/ });
    fireEvent.click(brandBtn);

    const deviceBtn = await screen.findByRole("button", { name: /TV 7,7/ });
    fireEvent.click(deviceBtn);

    const power = await screen.findByRole("button", { name: "POWER" });
    fireEvent.click(power);
    expect(await screen.findByText(/NECx2 · address 07 07 · code 02/)).toBeInTheDocument();
    expect(screen.getAllByText(/from irdb/).length).toBeGreaterThan(0);
    // The honest limit stands on the surface.
    expect(screen.getByText(/sends them once your blaster is hooked up/)).toBeInTheDocument();
  });

  it("shows a raw code as Pronto hex with a copy button", async () => {
    render(<RemoteCodesWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Samsung/ }));
    fireEvent.click(await screen.findByRole("button", { name: /TV 7,7/ }));
    fireEvent.click(await screen.findByRole("button", { name: "VOLUME +" }));
    const pronto = await screen.findByLabelText("Pronto hex");
    expect(pronto.textContent).toMatch(/^0000 006C 0002 0000/);
    expect(screen.getByRole("button", { name: "Copy the Pronto code" })).toBeInTheDocument();
  });

  it("setup numbers: list → brand → numbers in order, with the try-them steps", async () => {
    render(<RemoteCodesWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Setup numbers/ }));
    fireEvent.click(await screen.findByRole("button", { name: /SMPL remote code list/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Samsung" }));
    expect(await screen.findByText("1. 423")).toBeInTheDocument();
    expect(screen.getByText("2. 422")).toBeInTheDocument();
    expect(screen.getByText(/type the next number/)).toBeInTheDocument();
  });

  it("help shelf carries the plain steps and the provenance", async () => {
    render(<RemoteCodesWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Help/ }));
    expect(await screen.findByText(/Pick the brand name written on it/)).toBeInTheDocument();
    expect(screen.getByText(/Flipper IRDB/)).toBeInTheDocument();
    expect(screen.getByText(/will not make up a code/)).toBeInTheDocument();
  });

  it("an unknown brand gets the honest not-found words, not a made-up code", async () => {
    render(<RemoteCodesWindow onClose={vi.fn()} />);
    const input = await screen.findByLabelText("Brand name");
    fireEvent.change(input, { target: { value: "NoSuchBrand" } });
    await waitFor(() =>
      expect(screen.getByText(/not in the public lists Augie loaded/)).toBeInTheDocument(),
    );
  });
});
