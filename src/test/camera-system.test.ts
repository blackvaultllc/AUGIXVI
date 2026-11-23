import { describe, expect, it } from "vitest";
import {
  cameraCanControl,
  sanitizeCamera,
  sanitizeLens,
} from "@/avatar/cameras/cameraRegistry";
import { onvifPasswordDigest } from "@/avatar/cameras/onvifClient.server";
import { rtspUrlFor } from "@/avatar/cameras/cameraBridge.server";
import type { StoredCamera } from "@/avatar/cameraStore.server";

/**
 * CAMERA SYSTEM (2026-11-23) — the registry claims only what was
 * given or proven, the Permission Law gates control on BOTH flags,
 * the ONVIF digest matches the WS-Security formula, and the RTSP
 * URL is built from the server-side record (password included
 * only there, never in the public profile).
 */
describe("camera registry sanitize", () => {
  it("requires a name and a host", () => {
    expect(sanitizeCamera({ name: "Desk", host: "" })).toBeNull();
    expect(sanitizeCamera({ name: "", host: "10.0.0.9" })).toBeNull();
    expect(sanitizeCamera({ name: "Desk", host: "10.0.0.9" })).not.toBeNull();
  });

  it("defaults the classic ports and normalizes lens paths", () => {
    const camera = sanitizeCamera({
      name: "Yard",
      host: "10.0.0.9",
      lenses: [{ label: "Main", kind: "fixed", rtspPath: "ucast/11" }],
    });
    expect(camera?.rtspPort).toBe(554);
    expect(camera?.onvifPort).toBe(8080);
    expect(camera?.username).toBe("admin");
    expect(camera?.lenses[0]?.rtspPath).toBe("/ucast/11");
  });

  it("keeps the O-KAM family ports when given", () => {
    const camera = sanitizeCamera({
      name: "Desk",
      host: "10.0.0.9",
      rtspPort: 10554,
      onvifPort: 10080,
      lenses: [],
    });
    expect(camera?.rtspPort).toBe(10554);
    expect(camera?.onvifPort).toBe(10080);
  });

  it("drops a lens with no path and caps nonsense ports", () => {
    expect(sanitizeLens({ label: "x", rtspPath: "" }, 0)).toBeNull();
    const camera = sanitizeCamera({ name: "A", host: "h", rtspPort: 99999, lenses: [] });
    expect(camera?.rtspPort).toBe(554);
  });

  it("never carries a password in the public profile", () => {
    const camera = sanitizeCamera({ name: "A", host: "h", password: "should-not-survive" });
    expect(camera).not.toBeNull();
    expect(JSON.stringify(camera)).not.toContain("should-not-survive");
    expect(camera?.hasPassword).toBe(false);
  });
});

describe("camera Permission Law", () => {
  it("control requires ownership AND the grant", () => {
    expect(cameraCanControl({})).toBe(false);
    expect(cameraCanControl({ ownerConfirmed: true })).toBe(false);
    expect(cameraCanControl({ controlGranted: true })).toBe(false);
    expect(cameraCanControl({ ownerConfirmed: true, controlGranted: true })).toBe(true);
  });
});

describe("ONVIF password digest", () => {
  it("matches the WS-Security UsernameToken formula", () => {
    // SHA1( nonce-bytes + created + password ), base64 — vector
    // computed independently of this module.
    expect(
      onvifPasswordDigest("AAAAAAAAAAAAAAAAAAAAAA==", "2026-11-23T00:00:00.000Z", "test-password"),
    ).toBe("5M5Us4x0/BT7LI/fDT9jxIOE1u8=");
  });
});

describe("RTSP URL building (server-side record)", () => {
  const stored: StoredCamera = {
    id: "camera-1",
    name: "Desk",
    host: "10.0.0.9",
    rtspPort: 10554,
    onvifPort: 10080,
    username: "admin",
    password: "p@ss word",
    hasPassword: true,
    lenses: [{ id: "lens-1", label: "Fixed", kind: "fixed", rtspPath: "/tcp/av0_0" }],
    addedAt: 0,
  };

  it("embeds the credentials escaped, on the camera's own port and path", () => {
    const lens = stored.lenses[0];
    if (!lens) throw new Error("fixture lens missing");
    expect(rtspUrlFor(stored, lens)).toBe(
      "rtsp://admin:p%40ss%20word@10.0.0.9:10554/tcp/av0_0",
    );
  });

  it("omits the password segment when none is stored", () => {
    const open: StoredCamera = { ...stored, password: undefined, hasPassword: false };
    const lens = open.lenses[0];
    if (!lens) throw new Error("fixture lens missing");
    expect(rtspUrlFor(open, lens)).toBe("rtsp://admin@10.0.0.9:10554/tcp/av0_0");
  });
});
