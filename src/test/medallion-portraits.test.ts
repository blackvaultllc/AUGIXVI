import { describe, expect, it } from "vitest";
import { ANUBIS_FACE_SRC } from "@/avatar/AnubisPresence";
import {
  ANUBIS_PORTRAIT_SRC,
  CAPTAIN_INFINITY_PORTRAIT_SRC,
} from "@/avatar/medallionPortraits";

/**
 * The portrait registry keeps the command structure exact: the
 * Captain has his own registered medallion asset, while the face in
 * the Anubis Command medallion remains Anubis's portrait alone.
 */
describe("medallion portrait registry", () => {
  it("registers the Captain's portrait without placing it in Anubis's medallion", () => {
    expect(CAPTAIN_INFINITY_PORTRAIT_SRC).toBe("/owner-presence/captain-infinity.webp");
    expect(ANUBIS_PORTRAIT_SRC).toBe("/anubis-presence/face.webp");
    expect(CAPTAIN_INFINITY_PORTRAIT_SRC).not.toBe(ANUBIS_PORTRAIT_SRC);
    expect(ANUBIS_FACE_SRC).toBe(ANUBIS_PORTRAIT_SRC);
  });
});
