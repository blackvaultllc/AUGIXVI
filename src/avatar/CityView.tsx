import type { ReactNode } from "react";

export function CityView({ children }: { children?: ReactNode }) {
  return (
    <main className="city-view" aria-label="City">
      <div className="city-view__slot">{children ?? <p>City — loads with the deck merge</p>}</div>
    </main>
  );
}
