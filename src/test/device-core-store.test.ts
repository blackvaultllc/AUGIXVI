import { describe, expect, it } from "vitest";
import {
  canControl,
  type DeviceProfile,
} from "@/avatar/devices/deviceRegistry";
import {
  applyStateToStorage,
  emptyDeviceCoreState,
  localStateFromStorage,
  mergeLocalIntoCore,
  pendingFlagRequests,
  proposeFlagChange,
  resolveFlagRequest,
  sanitizeDeviceCoreState,
  seedDeviceCoreState,
  stateCommandsFor,
  WEPWAWET_DEVICE_ID,
  type DeviceCoreState,
} from "@/avatar/devices/deviceStoreCore";
import { WEPWAWET_DOG_PROFILE } from "@/avatar/devices/commandProfiles";

/**
 * THE DEVICE CORE STORE (2026-11-24) — the registry, bindings,
 * profiles, and log live in the core now. These pins hold the
 * migration (his existing cards — the dog's grant above all —
 * survive the move untouched), the one-control-map merge, and the
 * Permission Law's flag-request road: Anubis proposes, only the
 * Captain's hand applies.
 */

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    map,
  };
}

const localDog = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
  id: "device-1732483200000-1",
  displayName: "Wepwawet",
  kind: "other",
  transport: "ble",
  externalId: "",
  ownerConfirmed: true,
  controlGranted: true,
  presence: "unknown",
  presenceEvents: [],
  source: "manual",
  declaredServices: [],
  capabilities: [],
  limitations: [],
  batteryLevel: null,
  measured: {},
  firstSeen: 1,
  lastSeen: 2,
  ...over,
});

describe("the seed", () => {
  it("device #1 is the dog, with the Captain's recorded grant", () => {
    const seed = seedDeviceCoreState();
    const dog = seed.registry.find((d) => d.id === WEPWAWET_DEVICE_ID);
    expect(dog).toBeTruthy();
    expect(canControl(dog!)).toBe(true);
    expect(seed.bindings[WEPWAWET_DEVICE_ID]?.profileId).toBe(WEPWAWET_DOG_PROFILE.id);
    expect(seed.bindings[WEPWAWET_DEVICE_ID]?.address).toBe("A947C15E");
  });

  it("the dog's control map is generated from his profile — one map", () => {
    const seed = seedDeviceCoreState();
    const dog = seed.registry[0]!;
    const fromMap = (dog.controls ?? []).filter((c) => c.payload !== undefined);
    expect(fromMap.length).toBe(WEPWAWET_DOG_PROFILE.commands.length);
    const stop = fromMap.find((c) => c.id === "stop");
    expect(stop?.payload).toEqual(
      WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "stop")!.payload,
    );
    expect(stop?.verified).toBe(true); // proven live, watched, 2026-11-24
  });
});

describe("migration — mergeLocalIntoCore", () => {
  it("his real dog card steps over the seed, grant intact", () => {
    const local = emptyDeviceCoreState();
    const mine = localDog();
    local.registry = [mine];
    local.bindings = {
      [mine.id]: { deviceId: mine.id, profileId: WEPWAWET_DOG_PROFILE.id, address: "A947C15E" },
    };
    const merged = mergeLocalIntoCore(seedDeviceCoreState(), local);
    expect(merged.registry.some((d) => d.id === WEPWAWET_DEVICE_ID)).toBe(false);
    const dog = merged.registry.find((d) => d.id === mine.id);
    expect(dog).toBeTruthy();
    expect(canControl(dog!)).toBe(true);
    expect(merged.bindings[WEPWAWET_DEVICE_ID]).toBeUndefined();
    expect(merged.bindings[mine.id]?.profileId).toBe(WEPWAWET_DOG_PROFILE.id);
  });

  it("unions registry, bindings, and log; the incoming entry wins a clash", () => {
    const core = seedDeviceCoreState();
    const local = emptyDeviceCoreState();
    const wand = localDog({ id: "wand-1", displayName: "Magic Wand", controlGranted: undefined });
    local.registry = [wand];
    local.log = [
      {
        id: "cmdlog-1-1",
        deviceId: "wand-1",
        deviceName: "Magic Wand",
        profileId: "p",
        commandId: "c",
        commandName: "Ping",
        detail: "",
        at: 10,
        result: "sent",
        note: "ok",
      },
    ];
    const merged = mergeLocalIntoCore(core, local);
    expect(merged.registry.map((d) => d.id)).toContain("wand-1");
    expect(merged.registry.map((d) => d.id)).toContain(WEPWAWET_DEVICE_ID);
    expect(merged.log).toHaveLength(1);
  });

  it("the browser cache round-trips through the state shape", () => {
    const storage = memoryStorage();
    const state = seedDeviceCoreState();
    applyStateToStorage(state, storage);
    const back = localStateFromStorage(storage);
    expect(back.registry).toHaveLength(1);
    expect(canControl(back.registry[0]!)).toBe(true);
    expect(back.bindings[WEPWAWET_DEVICE_ID]?.address).toBe("A947C15E");
  });

  it("sanitize drops junk and keeps the shape", () => {
    const clean = sanitizeDeviceCoreState({ registry: [{ nope: true }, null], bindings: "x" });
    expect(clean.registry).toHaveLength(0);
    expect(clean.bindings).toEqual({});
    expect(clean.version).toBe(1);
  });
});

describe("one control map — stateCommandsFor", () => {
  it("merges profile commands and control-map payloads, deduped", () => {
    const state = seedDeviceCoreState();
    const dog = state.registry[0]!;
    const commands = stateCommandsFor(state, dog);
    // Profile and map carry the same ids — the merged list is the
    // profile's length, not double.
    expect(commands).toHaveLength(WEPWAWET_DOG_PROFILE.commands.length);
    expect(commands[0]?.id).toBe("stop");
  });

  it("a device with only a payload-carrying map still has commands", () => {
    const state = emptyDeviceCoreState();
    const drone = localDog({
      id: "drone-1",
      displayName: "Field drone",
      ownerConfirmed: undefined,
      controlGranted: undefined,
      controls: [
        {
          id: "take-off",
          label: "Take off",
          kind: "command",
          detail: "UDP packet to the drone hotspot",
          verified: true,
          payload: { kind: "lines", lines: ["TAKEOFF"] },
        },
        {
          id: "camera-note",
          label: "Camera note",
          kind: "other",
          detail: "Descriptive only — no payload, never fireable",
          verified: false,
        },
      ],
    });
    state.registry = [drone];
    const commands = stateCommandsFor(state, drone);
    expect(commands.map((c) => c.id)).toEqual(["take-off"]);
  });
});

describe("flag requests — Anubis proposes, the Captain applies", () => {
  const wandState = (): DeviceCoreState => {
    const state = emptyDeviceCoreState();
    state.registry = [
      localDog({ id: "wand-1", displayName: "Magic Wand", ownerConfirmed: undefined, controlGranted: undefined }),
    ];
    return state;
  };

  it("a proposal files a pending request and moves NO flag", () => {
    const state = wandState();
    const proposed = proposeFlagChange(state, {
      deviceId: "wand-1",
      ownerConfirmed: true,
      controlGranted: true,
      reason: "The Captain registered it as his own wand.",
      now: 100,
    });
    expect(proposed).not.toBeNull();
    const device = proposed!.state.registry[0]!;
    expect(canControl(device)).toBe(false);
    expect(device.ownerConfirmed).toBeUndefined();
    expect(pendingFlagRequests(proposed!.state)).toHaveLength(1);
  });

  it("only the Captain's resolve applies the flags", () => {
    const state = wandState();
    const proposed = proposeFlagChange(state, {
      deviceId: "wand-1",
      ownerConfirmed: true,
      controlGranted: true,
      reason: "his wand",
      now: 100,
    })!;
    const denied = resolveFlagRequest(proposed.state, proposed.request.id, "denied", 200);
    expect(canControl(denied.registry[0]!)).toBe(false);
    const applied = resolveFlagRequest(proposed.state, proposed.request.id, "applied", 200);
    expect(canControl(applied.registry[0]!)).toBe(true);
    expect(pendingFlagRequests(applied)).toHaveLength(0);
  });

  it("a proposal that changes nothing files nothing", () => {
    const state = seedDeviceCoreState();
    const proposed = proposeFlagChange(state, {
      deviceId: WEPWAWET_DEVICE_ID,
      ownerConfirmed: true,
      controlGranted: true,
      reason: "already so",
      now: 100,
    });
    expect(proposed).toBeNull();
  });
});
