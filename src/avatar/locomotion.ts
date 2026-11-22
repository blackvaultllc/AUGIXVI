import * as THREE from "three";

const FOOT_Y = -3.2;
const COMPACT_SCALE = 0.34;
const MIN_SPEED = 0.25;
const MAX_SPEED = 3;
const JUMP_SECONDS = 0.9;
const JUMP_HEIGHT = 1.1;
const DEFAULT_WALK_ROUTE = [
  { x: 0, z: 0 },
  { x: -2.2, z: 0.8 },
  { x: -1.4, z: 2.8 },
  { x: 1.6, z: 2.6 },
  { x: 2.2, z: 0.6 },
  { x: 0, z: 0 },
] as const;

/**
 * THE MARK (owner order): where he stands at load — origin, full size,
 * facing the operator. "Come back" must land him here WHOLE and IN FRAME
 * (defect 2026-11-21: he stopped halfway off-screen while the box claimed
 * he was "Returning to my mark" — the stage cancelled the return by
 * snapping him to face-forward mid-journey, and flight dropped out of
 * the sky instantly instead of gliding home).
 */
export const MARK = { x: 0, z: 0 } as const;
/** Cruise altitude for flight, in root units above the ground line. */
export const FLY_ALTITUDE = 2.3;
/** Horizontal tolerance for "he is standing on the mark". */
export const MARK_TOLERANCE = 0.08;
/** Altitude tolerance for "he has landed". */
export const LAND_TOLERANCE = 0.05;

/**
 * Return-to-mark arrival test — pure math, unit-tested. He counts as
 * home only when he is over the mark AND down: a return that ends while
 * he is still in the air, or off to one side, is not a return.
 */
export function hasArrivedAtMark(x: number, z: number, altitude: number): boolean {
  return (
    Math.abs(x - MARK.x) <= MARK_TOLERANCE &&
    Math.abs(z - MARK.z) <= MARK_TOLERANCE &&
    altitude <= LAND_TOLERANCE
  );
}

export type LocomotionMode = "idle" | "walk" | "run" | "fly" | "jump";
export type LocomotionPoint = Readonly<{ x: number; z: number }>;

export class AvatarLocomotion {
  private scaleTarget = 1;
  private mode: LocomotionMode = "idle";
  private returning = false;
  private looking = false;
  private speed = 1;
  private waypointIndex = 0;
  private jumpElapsed = 0;
  private loopRoute = true;
  /** Current height above the ground line — eased, never snapped. */
  private altitude = 0;
  /** Fly-and-hold: rise and hang in place (transforms, sky-hover idle). */
  private holdPosition = false;
  /** Arrived-at-mark face-the-operator flag: yaw returns to camera-forward (+z). */
  private faceCamera = false;
  /**
   * FULL-BODY HOLD (owner order 2026-11-22, live defect fix): on load
   * the construct flashed full-body, then shrank to the compact
   * companion presentation. The Captain's ruling: full body is a real,
   * HOLDABLE state. While the hold is on, nothing shrinks him — walk,
   * shrink commands, mode changes all keep scaleTarget at 1 — until
   * the Captain releases the hold himself. Default off: the compact
   * companion presentation stays the default, exactly as ordered.
   */
  private fullBodyHold = false;
  private waypoints: THREE.Vector3[] = DEFAULT_WALK_ROUTE.map(
    (point) => new THREE.Vector3(point.x, 0, point.z),
  );

  constructor(private root: THREE.Group) {}

  get currentMode() {
    return this.mode;
  }

  get currentSpeed() {
    return this.speed;
  }

  /** Height above the ground line (0 = standing on it). */
  get currentAltitude() {
    return this.altitude;
  }

  get isWalking() {
    return this.mode === "walk" || this.mode === "run";
  }

  get isMoving() {
    return this.mode === "walk" || this.mode === "run" || this.mode === "fly";
  }

  get isFlying() {
    return this.mode === "fly";
  }

  /**
   * Cruising = airborne, up at altitude, and travelling — the only state
   * where the renderer pitches him forward Superman-style. Takeoff and
   * hover keep him upright.
   */
  get isCruising() {
    return this.mode === "fly" && !this.holdPosition && this.altitude > FLY_ALTITUDE * 0.9;
  }

  /** Hanging in the sky, upright: takeoff, hold-position, or a return glide. */
  get isHovering() {
    return this.mode === "fly" && !this.isCruising;
  }

  get isReturning() {
    return this.returning;
  }

  get isLookingAround() {
    return this.looking;
  }

  setSpeed(speed: number) {
    if (!Number.isFinite(speed)) return this.speed;
    this.speed = THREE.MathUtils.clamp(speed, MIN_SPEED, MAX_SPEED);
    return this.speed;
  }

  setMode(mode: LocomotionMode) {
    this.mode = mode;
    this.returning = false;
    this.looking = false;
    this.holdPosition = false;
    if (mode === "walk" || mode === "run") {
      this.scaleTarget = this.fullBodyHold ? 1 : COMPACT_SCALE;
    }
    if (mode === "walk" || mode === "run" || mode === "fly") {
      if (!this.loopRoute) {
        this.waypoints = DEFAULT_WALK_ROUTE.map((point) => new THREE.Vector3(point.x, 0, point.z));
        this.waypointIndex = 0;
      }
      // BOSS'S ROUNDS (Part 9 amendment 2, owner order 2026-11-21):
      // the default route is walked ONCE — out around the floor and
      // back to his mark, where he stops. Looping it forever was the
      // "walking in circles like a crazy man" defect. A round has a
      // start and an end; circling is not a behavior he has anymore.
      this.loopRoute = false;
    }
    if (mode === "jump") this.jumpElapsed = 0;
  }

  shrink() {
    // The full-body hold outranks a shrink: he stays whole until the
    // Captain releases the hold (see the hold note on the field).
    this.scaleTarget = this.fullBodyHold ? 1 : COMPACT_SCALE;
  }

  get isFullBodyHeld() {
    return this.fullBodyHold;
  }

  /** Throw or release the full-body hold. Throwing it grows him to
   * full size now; releasing it returns him to the compact companion
   * presentation. */
  setFullBodyHold(held: boolean) {
    this.fullBodyHold = held;
    if (held) {
      this.grow();
    } else if (this.mode !== "fly") {
      // Releasing mid-flight keeps him whole until he lands; a landed
      // return still arrives full-size (the come-back rule), and the
      // next walk/shrink settles him back to companion size.
      this.scaleTarget = COMPACT_SCALE;
    }
  }

  grow() {
    this.mode = "idle";
    this.returning = false;
    this.looking = false;
    this.holdPosition = false;
    this.jumpElapsed = 0;
    this.scaleTarget = 1;
  }

  walk() {
    this.setMode("walk");
  }

  run() {
    this.setMode("run");
  }

  fly() {
    this.setMode("fly");
  }

  /** Rise and hang in place — upright sky-hover (transforms use this). */
  hover() {
    this.setMode("fly");
    this.holdPosition = true;
  }

  jump() {
    this.setMode("jump");
  }

  idle() {
    this.mode = "idle";
    this.returning = false;
    this.holdPosition = false;
    this.jumpElapsed = 0;
  }

  lookAround() {
    this.looking = true;
  }

  followPath(points: readonly LocomotionPoint[]) {
    if (points.length < 2) return false;
    this.setMode("walk");
    this.waypoints = points.map((point) => new THREE.Vector3(point.x, 0, point.z));
    this.waypointIndex = 0;
    this.loopRoute = false;
    return true;
  }

  comeBack() {
    // From the ground he walks home; from the air he glides home and
    // lands. Either way the journey actually happens — nothing snaps.
    if (this.mode !== "fly") this.mode = "walk";
    this.returning = true;
    this.looking = false;
    this.holdPosition = false;
    this.faceCamera = true; // when he arrives, he faces ME
  }

  stop() {
    this.idle();
    this.looking = false;
  }

  /** Alert: face the camera immediately from wherever he stands. */
  faceForward() {
    this.faceCamera = false;
    this.returning = false;
    this.looking = false;
    this.holdPosition = false;
    this.mode = "idle";
    this.root.rotation.y = 0; // 0 yaw = facing the camera
  }

  /**
   * SIDE VIEW (owner order 2026-11-22): stepped aside, he holds a
   * profile — turned toward the middle of the stage, so the Captain
   * sees him side-on and the whole screen stays clear. Yaw ±90° from
   * camera-forward; faceForward() restores the front.
   */
  faceSide(direction: 1 | -1) {
    this.faceCamera = false;
    this.returning = false;
    this.looking = false;
    this.holdPosition = false;
    this.mode = "idle";
    this.root.rotation.y = direction * (Math.PI / 2);
  }

  tick(deltaSeconds: number) {
    const delta = Math.max(0, Math.min(deltaSeconds, 0.05));
    this.root.scale.lerp(
      new THREE.Vector3(this.scaleTarget, this.scaleTarget, this.scaleTarget),
      1 - Math.exp(-5 * delta),
    );

    // ALTITUDE: eased toward its target every frame, in every mode, so
    // takeoff climbs, landings settle, and a come-back from the air
    // glides down instead of dropping out of the sky. A flying return
    // holds cruise height until the final approach over the mark, then
    // descends — he never stalls mid-air crawling toward home.
    let altitudeTarget = 0;
    if (this.mode === "fly") {
      if (this.returning) {
        const dx = this.root.position.x - MARK.x;
        const dz = this.root.position.z - MARK.z;
        altitudeTarget = Math.hypot(dx, dz) > 1 ? FLY_ALTITUDE : 0;
      } else {
        altitudeTarget = FLY_ALTITUDE;
      }
    }
    this.altitude += (altitudeTarget - this.altitude) * (1 - Math.exp(-2 * delta));

    const groundY = FOOT_Y * (1 - this.root.scale.y);
    let jumpOffset = 0;
    if (this.mode === "jump") {
      this.jumpElapsed = Math.min(JUMP_SECONDS, this.jumpElapsed + delta);
      const progress = this.jumpElapsed / JUMP_SECONDS;
      jumpOffset = 4 * JUMP_HEIGHT * progress * (1 - progress);
      if (progress >= 1) {
        this.mode = "idle";
        this.jumpElapsed = 0;
        jumpOffset = 0;
      }
    }
    this.root.position.y = groundY + this.altitude + jumpOffset;

    if (!this.isMoving && !this.returning) return;

    // TAKEOFF BEFORE TRAVEL: horizontal flight speed scales with how
    // high he has climbed, so "fly" reads as rise-first, then go.
    const travelScale =
      this.mode === "fly" ? THREE.MathUtils.clamp(this.altitude / FLY_ALTITUDE, 0, 1) : 1;

    if (this.returning) {
      this.tickReturn(delta, travelScale);
      return;
    }

    if (this.mode === "fly" && this.holdPosition) return; // hover: hang here

    const target = this.waypoints[this.waypointIndex]!.clone().setY(this.root.position.y);
    const direction = target.clone().sub(this.root.position);
    const distance = direction.length();
    if (distance < 0.08) {
      this.root.position.copy(target);
      if (this.loopRoute) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      } else if (this.waypointIndex + 1 < this.waypoints.length) {
        this.waypointIndex += 1;
      } else {
        this.mode = "idle";
      }
      return;
    }

    direction.normalize();
    const modeSpeed = this.mode === "run" ? 2.4 : this.mode === "fly" ? 1.8 : 1.15;
    this.root.position.addScaledVector(
      direction,
      Math.min(distance, delta * modeSpeed * this.speed * travelScale),
    );
    this.turnToward(direction, delta);
  }

  /** Glide/walk home to the mark; arrive whole, full size, facing me. */
  private tickReturn(delta: number, travelScale: number) {
    const target = new THREE.Vector3(MARK.x, this.root.position.y, MARK.z);
    const direction = target.clone().sub(this.root.position);
    direction.y = 0;
    const distance = direction.length();

    if (distance > MARK_TOLERANCE) {
      direction.normalize();
      const modeSpeed = this.mode === "fly" ? 1.8 : this.mode === "run" ? 2.4 : 1.15;
      // A return glide never crawls: keep at least gliding speed even
      // while the altitude settles on final approach.
      const glideScale = this.mode === "fly" ? Math.max(travelScale, 0.45) : 1;
      this.root.position.addScaledVector(
        direction,
        Math.min(distance, delta * modeSpeed * this.speed * glideScale),
      );
      this.turnToward(direction, delta);
    } else {
      // Over the mark: hold position while the altitude settles.
      this.root.position.x = MARK.x;
      this.root.position.z = MARK.z;
    }

    if (hasArrivedAtMark(this.root.position.x, this.root.position.z, this.altitude)) {
      this.root.position.x = MARK.x;
      this.root.position.z = MARK.z;
      this.returning = false;
      this.mode = "idle";
      this.scaleTarget = 1;
      // COME BACK = FACE ME: settle yaw toward the camera (+z) on arrival.
      if (this.faceCamera) this.root.rotation.y = 0;
      this.faceCamera = false;
    }
  }

  private turnToward(direction: THREE.Vector3, delta: number) {
    const desiredYaw = Math.atan2(direction.x, direction.z);
    const yawDelta =
      THREE.MathUtils.euclideanModulo(desiredYaw - this.root.rotation.y + Math.PI, Math.PI * 2) -
      Math.PI;
    this.root.rotation.y += THREE.MathUtils.clamp(yawDelta, -delta * 2.8, delta * 2.8);
  }
}
