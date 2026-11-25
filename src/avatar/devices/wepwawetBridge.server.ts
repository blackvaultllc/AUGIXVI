/**
 * WEPWAWET BRIDGE — the server half, now a face of the generalized
 * device bridge (owner order 2026-11-24, plan item D). The dog is
 * device #1 through the general door (deviceBridge.server.ts):
 * same core registry lookup, same staged sender, same argv-only
 * run, same kill switch (WEPWAWET_BRIDGE=off still closes his
 * path), same one-burst-at-a-time rule — now per device.
 *
 * This module keeps the dog door's original export so the legacy
 * route (/api/devices/wepwawet) runs unchanged on top of the
 * general bridge.
 */
import { runDeviceFrame, type DeviceBridgeRun } from "./deviceBridge.server";
import { WEPWAWET_DEVICE_ID } from "./deviceStoreCore";
import type { WepwawetBridgeRequest } from "./wepwawetBridge";

export type WepwawetBridgeRun = DeviceBridgeRun;

export async function runWepwawetFrame(
  req: WepwawetBridgeRequest,
): Promise<WepwawetBridgeRun> {
  return runDeviceFrame({ deviceId: WEPWAWET_DEVICE_ID, ...req });
}
