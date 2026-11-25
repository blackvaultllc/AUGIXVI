/**
 * DEVICE CORE SYNC — the client road between a surface's working
 * cache (localStorage) and the core's device store (owner order
 * 2026-11-24).
 *
 * THE RULES:
 *   · Pull (on stage mount, on Devices open): fetch the core state,
 *     merge the local cache into it, write the merged state back
 *     to BOTH homes. The first pull on a machine whose browser
 *     already holds the Captain's cards IS the migration — his
 *     dog's card and control grant move into the core untouched.
 *   · Push (after the Captain changes something): send the local
 *     state up; the core merges it over its own and returns the
 *     result, which becomes the local cache.
 *   · No operator session, or no core on this surface: the sync
 *     simply does not happen and the cache keeps working — nothing
 *     is faked, and the module remembers the last merged state so
 *     the capability brief and the construct tools read the same
 *     truth the Devices window shows.
 */
import { operatorAccessToken } from "../learner/daddyInboxClient";
import { getDeviceCore, putDeviceCore } from "./deviceCore.server";
import {
  applyStateToStorage,
  localStateFromStorage,
  mergeLocalIntoCore,
  type DeviceCoreState,
} from "./deviceStoreCore";

let lastKnownState: DeviceCoreState | null = null;
let syncInFlight: Promise<DeviceCoreState | null> | null = null;

/** The freshest device state this surface knows — the merged core
 *  state after a sync, else the local cache read as a state. */
export function currentDeviceState(): DeviceCoreState {
  return lastKnownState ?? localStateFromStorage();
}

export function rememberDeviceState(state: DeviceCoreState): void {
  lastKnownState = state;
}

/**
 * One full sync round trip. Returns the merged state, or null when
 * there is no operator session or no core on this surface (the
 * cache then stands as-is).
 */
export async function syncDevicesWithCore(): Promise<DeviceCoreState | null> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const accessToken = await operatorAccessToken().catch(() => null);
      if (!accessToken) return null;
      const view = await getDeviceCore({ data: { accessToken } }).catch(() => null);
      if (!view || !view.authorized || !view.available || !view.state) return null;
      const merged = mergeLocalIntoCore(view.state, localStateFromStorage());
      lastKnownState = merged;
      applyStateToStorage(merged);
      // When the merge brought something the core did not have
      // (the migration case), write the merged state back up.
      if (JSON.stringify(merged) !== JSON.stringify(view.state)) {
        const stored = await putDeviceCore({ data: { accessToken, state: merged } }).catch(
          () => null,
        );
        if (stored?.state) {
          lastKnownState = stored.state;
          applyStateToStorage(stored.state);
          return stored.state;
        }
      }
      return merged;
    } catch {
      return null;
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

/** Push the local cache up after a change; returns the core's
 *  merged state, or null when the push could not happen. */
export async function pushDevicesToCore(): Promise<DeviceCoreState | null> {
  try {
    const accessToken = await operatorAccessToken().catch(() => null);
    if (!accessToken) return null;
    const local = localStateFromStorage();
    const view = await putDeviceCore({ data: { accessToken, state: local } }).catch(() => null);
    if (!view || !view.authorized || !view.available || !view.state) return null;
    lastKnownState = view.state;
    applyStateToStorage(view.state);
    return view.state;
  } catch {
    return null;
  }
}
