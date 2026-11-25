/**
 * DEVICE BRIDGE — the server half (core-local). Runs ONE bridge
 * frame for a named device through that device's staged sender and
 * returns the sender's own printed words as the receipt.
 *
 * Doors, all closed by default:
 *   · DEVICE_BRIDGE=off in the server environment closes the whole
 *     door; WEPWAWET_BRIDGE=off still closes the dog's path, as it
 *     always has.
 *   · The device must be registered in the core store, with a
 *     broadcast profile whose sender resolves under ~/augie-tools/
 *     and exists there — on any other machine the bridge reports
 *     UNAVAILABLE in words.
 *   · One burst at a time PER DEVICE: a second frame for a device
 *     whose burst is on air is refused (409), never overlapped.
 *   · The sender itself refuses to transmit without --live, and
 *     re-verifies its encoder on every start.
 */
import { homedir } from "node:os";
import {
  resolveDeviceSender,
  senderArgsForDeviceFrame,
  type DeviceBridgeRequest,
} from "./deviceBridge";
import { WEPWAWET_DOG_PROFILE } from "./commandProfiles";
import type { DeviceCoreState } from "./deviceStoreCore";

export type DeviceBridgeRun =
  | { ok: true; mode: "live" | "dry"; output: string }
  | { ok: false; status: number; error: string };

const busyDevices = new Set<string>();

export type DeviceBridgeDeps = {
  env?: NodeJS.ProcessEnv;
  /** Skip the core-store read (tests). */
  state?: DeviceCoreState;
  /** Skip the real sender run (tests): receives the resolved
   *  sender path + request, returns its printed words. */
  senderRunner?: (senderPath: string, req: DeviceBridgeRequest) => Promise<string>;
};

async function execSender(senderPath: string, req: DeviceBridgeRequest): Promise<string> {
  const { execFile } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    execFile(
      "python3",
      senderArgsForDeviceFrame(senderPath, req),
      { timeout: req.holdMs + 30_000, maxBuffer: 256 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const words = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
          reject(
            new Error(
              words
                ? `The sender refused: ${words.slice(-600)}`
                : `The sender failed to run (${error.message}).`,
            ),
          );
          return;
        }
        resolve(String(stdout).trim());
      },
    );
  });
}

export async function runDeviceFrame(
  req: DeviceBridgeRequest,
  deps: DeviceBridgeDeps = {},
): Promise<DeviceBridgeRun> {
  const env = deps.env ?? process.env;
  if (env["DEVICE_BRIDGE"] === "off") {
    return {
      ok: false,
      status: 501,
      error: "The device bridge is switched off on this server (DEVICE_BRIDGE=off). Nothing was sent.",
    };
  }
  let state = deps.state;
  if (!state) {
    try {
      const { readDeviceCore } = await import("./deviceStore.server");
      const read = await readDeviceCore(env);
      if (!read.available) {
        return {
          ok: false,
          status: 501,
          error: "The device core store is unavailable on this server — the bridge lives on the core machine. Nothing was sent.",
        };
      }
      state = read.state;
    } catch {
      return {
        ok: false,
        status: 501,
        error: "The device bridge lives on the core's own server — this server cannot read the registry. Nothing was sent.",
      };
    }
  }
  const home = env["HOME"]?.trim() || homedir();
  const resolution = resolveDeviceSender(state, req.deviceId, home);
  if (!resolution.ok) return resolution;
  if (
    resolution.profile.id === WEPWAWET_DOG_PROFILE.id &&
    env["WEPWAWET_BRIDGE"] === "off"
  ) {
    return {
      ok: false,
      status: 501,
      error: "The Wepwawet bridge is switched off on this server (WEPWAWET_BRIDGE=off). Nothing was sent.",
    };
  }
  let senderPath = resolution.senderPath;
  // The dog's standing staging override, kept from the dog-only
  // door — still fenced to ~/augie-tools/ by the same allowlist.
  if (resolution.profile.id === WEPWAWET_DOG_PROFILE.id && env["WEPWAWET_SENDER_PATH"]) {
    const { resolveSenderPath } = await import("./deviceBridge");
    const override = resolveSenderPath(home, env["WEPWAWET_SENDER_PATH"]);
    if (!override) {
      return {
        ok: false,
        status: 500,
        error: "WEPWAWET_SENDER_PATH does not resolve under ~/augie-tools/ — the bridge refuses to run anything outside that directory. Nothing was sent.",
      };
    }
    senderPath = override;
  }
  const { existsSync } = await import("node:fs");
  if (!deps.senderRunner && !existsSync(senderPath)) {
    return {
      ok: false,
      status: 501,
      error: `The sender for ${resolution.deviceName} is not staged on this machine (${senderPath} is missing) — the bridge lives on the core machine, where parrot-update.sh stages the senders from the repo. Nothing was sent.`,
    };
  }
  if (busyDevices.has(req.deviceId)) {
    return {
      ok: false,
      status: 409,
      error: `A broadcast is already on air for ${resolution.deviceName} — wait for it to finish, then send again. Nothing more was sent.`,
    };
  }
  busyDevices.add(req.deviceId);
  try {
    const output = deps.senderRunner
      ? await deps.senderRunner(senderPath, req)
      : await execSender(senderPath, req);
    return { ok: true, mode: req.live ? "live" : "dry", output };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: `${error instanceof Error ? error.message : "The sender failed."} Nothing further was sent.`,
    };
  } finally {
    busyDevices.delete(req.deviceId);
  }
}
