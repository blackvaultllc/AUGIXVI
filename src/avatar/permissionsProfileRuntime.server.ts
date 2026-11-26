/**
 * PERMISSIONS PROFILE RUNTIME — node-only, server-side. The
 * living half of the uniform-permissions rule (the Captain,
 * 2026-11-26): the ONE shared profile in the core is the source
 * every camera and every registered device is reconciled from.
 *
 *   · GATHER — the fleet as it stands: the camera registry and
 *     the device core's registry (Bluetooth included), each
 *     item's flags as its own store carries them now.
 *   · BIRTH — the profile's first reconcile seeds the shared
 *     profile from the fleet as found, so its birth changes
 *     nothing under the Captain.
 *   · PLAN + APPLY — the pure planner (permissionsProfile.ts)
 *     decides: untouched items take the effective flags
 *     (deviation if one stands, else shared); items changed by
 *     the Captain's own hand elsewhere are adopted as
 *     deviations, never stripped; retired devices are never
 *     written. Writes land through the stores' own serialized
 *     roads.
 *
 * Reconcile runs when the window asks, when the profile or a
 * deviation changes, and on the Sector Watch scheduler's slow
 * beat — so a newly registered camera or device takes the
 * shared profile on its own, without a hand ever setting its
 * flags.
 */
import { getCameraStore } from "./cameraStore.server";
import { getPermissionsProfileStore } from "./permissionsProfileStore.server";
import {
  mutateDeviceCore,
  readDeviceCore,
} from "./devices/deviceStore.server";
import {
  effectiveFlags,
  flagsEqual,
  hasDeviation,
  itemKey,
  planPermissionsReconcile,
  seedProfileFromFleet,
  type PermissionFlags,
  type PermissionItemKind,
  type PermissionItemState,
  type PermissionsProfileFile,
} from "./permissionsProfile";

export interface PermissionItemRow {
  key: string;
  kind: PermissionItemKind;
  id: string;
  name: string;
  retired: boolean;
  /** The flags the item's own store carries right now. */
  current: PermissionFlags;
  /** The flags the profile says it should carry. */
  effective: PermissionFlags;
  /** True when this item stands on an explicit deviation. */
  deviates: boolean;
}

export interface PermissionsView {
  available: boolean;
  profile: PermissionFlags;
  items: PermissionItemRow[];
}

async function gatherItems(): Promise<{
  items: PermissionItemState[];
  names: Map<string, string>;
}> {
  const items: PermissionItemState[] = [];
  const names = new Map<string, string>();
  const cameraStore = await getCameraStore();
  if (cameraStore) {
    for (const camera of await cameraStore.list()) {
      items.push({
        kind: "camera",
        id: camera.id,
        retired: false,
        current: {
          ownerConfirmed: camera.ownerConfirmed === true,
          controlGranted: camera.controlGranted === true,
        },
      });
      names.set(itemKey("camera", camera.id), camera.name || camera.id);
    }
  }
  const core = await readDeviceCore();
  if (core.available) {
    for (const device of core.state.registry) {
      items.push({
        kind: "device",
        id: device.id,
        retired: device.retired !== undefined && device.retired !== null,
        current: {
          ownerConfirmed: device.ownerConfirmed === true,
          controlGranted: device.controlGranted === true,
        },
      });
      names.set(itemKey("device", device.id), device.displayName || device.id);
    }
  }
  return { items, names };
}

/**
 * Reconcile every registered camera and device against the
 * shared profile. Returns the profile file after reconcile, or
 * null where the core stores are unavailable.
 */
export async function reconcilePermissions(): Promise<PermissionsProfileFile | null> {
  const profileStore = await getPermissionsProfileStore();
  if (!profileStore) return null;
  const { items } = await gatherItems();
  let file = await profileStore.read();
  if (!file.born) {
    const seed = seedProfileFromFleet(items);
    file = await profileStore.update((f) => ({ ...f, born: true, profile: seed }));
  }
  const plan = planPermissionsReconcile(file, items);
  // Apply the writes through each store's own road.
  const cameraWrites = new Map<string, PermissionFlags>();
  const deviceWrites = new Map<string, PermissionFlags>();
  for (const [key, flags] of plan.writes) {
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "camera") cameraWrites.set(id, flags);
    else if (kind === "device") deviceWrites.set(id, flags);
  }
  if (cameraWrites.size > 0) {
    const cameraStore = await getCameraStore();
    if (cameraStore) {
      for (const camera of await cameraStore.list()) {
        const flags = cameraWrites.get(camera.id);
        if (!flags) continue;
        await cameraStore.upsert({
          ...camera,
          ownerConfirmed: flags.ownerConfirmed ? true : undefined,
          controlGranted: flags.controlGranted ? true : undefined,
        });
      }
    }
  }
  if (deviceWrites.size > 0) {
    await mutateDeviceCore((state) => ({
      ...state,
      registry: state.registry.map((device) => {
        const flags = deviceWrites.get(device.id);
        if (!flags || device.retired) return device;
        return {
          ...device,
          ownerConfirmed: flags.ownerConfirmed ? true : undefined,
          controlGranted: flags.controlGranted ? true : undefined,
        };
      }),
    }));
  }
  const next = await profileStore.update(() => plan.nextFile);
  return next;
}

/** The window's view: reconcile first, then read the fleet as it stands. */
export async function permissionsView(): Promise<PermissionsView> {
  const file = await reconcilePermissions();
  const profileStore = await getPermissionsProfileStore();
  if (!file || !profileStore) {
    return {
      available: false,
      profile: { ownerConfirmed: false, controlGranted: false },
      items: [],
    };
  }
  const { items, names } = await gatherItems();
  const rows: PermissionItemRow[] = items.map((item) => {
    const effective = effectiveFlags(file, item.kind, item.id);
    return {
      key: itemKey(item.kind, item.id),
      kind: item.kind,
      id: item.id,
      name: names.get(itemKey(item.kind, item.id)) ?? item.id,
      retired: item.retired,
      current: item.current,
      effective,
      deviates: hasDeviation(file, item.kind, item.id) && !flagsEqual(effective, file.profile),
    };
  });
  return { available: true, profile: file.profile, items: rows };
}
