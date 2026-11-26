/**
 * UNIFORM PERMISSIONS — the pure core (the Captain's standing
 * rule, 2026-11-26: "Make sure all permissions are always the
 * same for each camera unless changed otherwise — even for our
 * Bluetooth devices").
 *
 * ONE shared permission profile lives in the core. Every
 * registered camera and every registered device (Bluetooth
 * included) inherits it identically; the per-store flags
 * (ownerConfirmed / controlGranted in the camera registry and
 * the device core alike) are RECONCILED from it. Changing the
 * shared profile changes all of them at once. A per-item
 * DEVIATION may exist only where the Captain explicitly set
 * flags for that one item — and the reconcile plan below is
 * careful about what "explicitly set" means:
 *
 *   · An item whose store flags still equal what reconcile
 *     last applied is UNTOUCHED: it takes the effective flags
 *     (its deviation if one stands, else the shared profile).
 *   · An item whose store flags CHANGED since the last
 *     reconcile was changed by the Captain's own hand somewhere
 *     (a grant in the Cameras window, a confirmed flag request
 *     in the Devices window). Reconcile never strips his hand:
 *     the new state is ADOPTED as that item's deviation and
 *     shown as one in the window.
 *   · An item seen for the first time (newly registered, or
 *     the profile's first birth) is adopted as found, unless
 *     it already equals the effective flags.
 *   · A RETIRED device is never written and never adopted —
 *     retirement stripped its flags for good, and no profile
 *     may resurrect a grant (the dog's law).
 *
 * Plain TS, no I/O — the runtime does the dialing.
 */

export type PermissionItemKind = "camera" | "device";

export interface PermissionFlags {
  ownerConfirmed: boolean;
  controlGranted: boolean;
}

/** The Permission Law's default: flags are NO until granted. */
export const DEFAULT_SHARED_PROFILE: PermissionFlags = {
  ownerConfirmed: false,
  controlGranted: false,
};

export interface PermissionsProfileFile {
  /** False until the first reconcile seeds the profile from the fleet as found. */
  born: boolean;
  profile: PermissionFlags;
  /** The Captain's explicit per-item settings, keyed `${kind}:${id}`. */
  deviations: Record<string, Partial<PermissionFlags>>;
  /** What reconcile last applied/read per item — the untouched test. */
  applied: Record<string, PermissionFlags>;
  /** Bumped on every explicit profile/deviation change from the window. */
  version: number;
  updatedAt: number;
}

export function emptyPermissionsProfile(): PermissionsProfileFile {
  return {
    born: false,
    profile: { ...DEFAULT_SHARED_PROFILE },
    deviations: {},
    applied: {},
    version: 0,
    updatedAt: 0,
  };
}

export function itemKey(kind: PermissionItemKind, id: string): string {
  return `${kind}:${id}`;
}

/** The flags one item should carry: its deviation where set, else the shared profile. */
export function effectiveFlags(
  file: PermissionsProfileFile,
  kind: PermissionItemKind,
  id: string,
): PermissionFlags {
  const deviation = file.deviations[itemKey(kind, id)];
  return {
    ownerConfirmed: deviation?.ownerConfirmed ?? file.profile.ownerConfirmed,
    controlGranted: deviation?.controlGranted ?? file.profile.controlGranted,
  };
}

/** True when an item carries a standing deviation from the shared profile. */
export function hasDeviation(
  file: PermissionsProfileFile,
  kind: PermissionItemKind,
  id: string,
): boolean {
  const deviation = file.deviations[itemKey(kind, id)];
  return deviation !== undefined && Object.keys(deviation).length > 0;
}

export function flagsEqual(a: PermissionFlags, b: PermissionFlags): boolean {
  return a.ownerConfirmed === b.ownerConfirmed && a.controlGranted === b.controlGranted;
}

/* ------------------------------------------------------------------ */
/* Sanitizers                                                          */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanFlags(v: unknown): PermissionFlags | null {
  if (!isRecord(v)) return null;
  if (typeof v["ownerConfirmed"] !== "boolean" || typeof v["controlGranted"] !== "boolean") {
    return null;
  }
  return { ownerConfirmed: v["ownerConfirmed"], controlGranted: v["controlGranted"] };
}

function cleanPartialFlags(v: unknown): Partial<PermissionFlags> | null {
  if (!isRecord(v)) return null;
  const out: Partial<PermissionFlags> = {};
  if (typeof v["ownerConfirmed"] === "boolean") out.ownerConfirmed = v["ownerConfirmed"];
  if (typeof v["controlGranted"] === "boolean") out.controlGranted = v["controlGranted"];
  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizePermissionsProfile(v: unknown): PermissionsProfileFile {
  const base = emptyPermissionsProfile();
  if (!isRecord(v)) return base;
  const deviations: Record<string, Partial<PermissionFlags>> = {};
  if (isRecord(v["deviations"])) {
    for (const [key, value] of Object.entries(v["deviations"])) {
      const clean = cleanPartialFlags(value);
      if (clean && key.length <= 128) deviations[key] = clean;
    }
  }
  const applied: Record<string, PermissionFlags> = {};
  if (isRecord(v["applied"])) {
    for (const [key, value] of Object.entries(v["applied"])) {
      const clean = cleanFlags(value);
      if (clean && key.length <= 128) applied[key] = clean;
    }
  }
  return {
    born: v["born"] === true,
    profile: cleanFlags(v["profile"]) ?? base.profile,
    deviations,
    applied,
    version:
      typeof v["version"] === "number" && Number.isFinite(v["version"]) ? v["version"] : 0,
    updatedAt:
      typeof v["updatedAt"] === "number" && Number.isFinite(v["updatedAt"]) ? v["updatedAt"] : 0,
  };
}

/* ------------------------------------------------------------------ */
/* The reconcile plan — pure                                         */
/* ------------------------------------------------------------------ */

export interface PermissionItemState {
  kind: PermissionItemKind;
  id: string;
  /** Retired items are never written, never adopted. */
  retired: boolean;
  /** The flags the item's own store carries right now. */
  current: PermissionFlags;
}

export interface ReconcilePlan {
  /** Flags to write into the items' own stores, by item key. */
  writes: Map<string, PermissionFlags>;
  /** The profile file after reconcile (deviations/applied updated). */
  nextFile: PermissionsProfileFile;
}

export function planPermissionsReconcile(
  file: PermissionsProfileFile,
  items: PermissionItemState[],
): ReconcilePlan {
  const writes = new Map<string, PermissionFlags>();
  const deviations: Record<string, Partial<PermissionFlags>> = { ...file.deviations };
  const applied: Record<string, PermissionFlags> = { ...file.applied };
  const nextFile: PermissionsProfileFile = { ...file, deviations, applied };

  for (const item of items) {
    if (item.retired) continue;
    const key = itemKey(item.kind, item.id);
    const effective = effectiveFlags(nextFile, item.kind, item.id);
    const last = applied[key];
    if (last === undefined) {
      // First sight: adopt the item as found. If it already
      // equals the effective flags, nothing stands out; if it
      // differs, its standing state becomes its deviation —
      // it was set per-item before the profile existed.
      if (!flagsEqual(item.current, effective)) {
        deviations[key] = { ...item.current };
      }
      applied[key] = item.current;
      continue;
    }
    if (flagsEqual(item.current, last)) {
      // Untouched since the last reconcile: the effective
      // flags rule. Write only on a real change.
      if (!flagsEqual(item.current, effective)) {
        writes.set(key, effective);
        applied[key] = effective;
      }
      continue;
    }
    // Changed outside the profile since the last reconcile —
    // the Captain's own hand somewhere. Adopt, never strip.
    deviations[key] = { ...item.current };
    applied[key] = item.current;
  }
  return { writes, nextFile };
}

/**
 * The first-birth seed: when the profile is born on a core that
 * already has a fleet, the shared profile starts as the fleet's
 * standing word — granted where his registered fleet stands
 * granted — so the profile's birth changes nothing under him.
 * A core with no granted item is born at the Permission Law's
 * default (all NO).
 */
export function seedProfileFromFleet(items: PermissionItemState[]): PermissionFlags {
  const anyGranted = items.some(
    (i) => !i.retired && i.current.ownerConfirmed && i.current.controlGranted,
  );
  return anyGranted
    ? { ownerConfirmed: true, controlGranted: true }
    : { ...DEFAULT_SHARED_PROFILE };
}
