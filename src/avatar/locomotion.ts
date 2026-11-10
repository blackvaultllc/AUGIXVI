import * as THREE from "three";
import { WORLD_RULES, type WorldPoint } from "./worldRules";

const FOOT_Y = -3.2;
const COMPACT_SCALE = 0.34;
const MIN_SPEED = 0.25;
const MAX_SPEED = 3;
const JUMP_SECONDS = 0.9;
const JUMP_HEIGHT = 1.1;

export type LocomotionMode = "idle" | "walk" | "run" | "fly" | "jump";

export class AvatarLocomotion {
  private scaleTarget = 1;
  private mode: LocomotionMode = "idle";
  private returning = false;
  private looking = false;
  private speed = 1;
  private waypointIndex = 0;
  private jumpElapsed = 0;
  private loopRoute = true;
  private waypoints: THREE.Vector3[] = WORLD_RULES.walkRoute.map(
    (point) => new THREE.Vector3(point.x, 0, point.z),
  );

  constructor(private root: THREE.Group) {}

  get currentMode() {
    return this.mode;
  }

  get currentSpeed() {
    return this.speed;
  }

  get isWalking() {
    return this.mode === "walk" || this.mode === "run";
  }

  get isMoving() {
    return this.mode === "walk" || this.mode === "run" || this.mode === "fly";
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
    if (mode === "walk" || mode === "run" || mode === "fly") {
      this.scaleTarget = COMPACT_SCALE;
      if (!this.loopRoute) {
        this.waypoints = WORLD_RULES.walkRoute.map(
          (point) => new THREE.Vector3(point.x, 0, point.z),
        );
        this.waypointIndex = 0;
        this.loopRoute = true;
      }
    }
    if (mode === "jump") this.jumpElapsed = 0;
  }

  shrink() {
    this.scaleTarget = COMPACT_SCALE;
  }

  grow() {
    this.mode = "idle";
    this.returning = false;
    this.looking = false;
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

  jump() {
    this.setMode("jump");
  }

  idle() {
    this.mode = "idle";
    this.returning = false;
    this.jumpElapsed = 0;
  }

  lookAround() {
    this.looking = true;
  }

  followPath(points: readonly WorldPoint[]) {
    if (points.length < 2) return false;
    this.setMode("walk");
    this.waypoints = points.map((point) => new THREE.Vector3(point.x, 0, point.z));
    this.waypointIndex = 0;
    this.loopRoute = false;
    return true;
  }

  comeBack() {
    this.mode = "walk";
    this.returning = true;
    this.looking = false;
    this.scaleTarget = COMPACT_SCALE;
  }

  stop() {
    this.idle();
    this.looking = false;
  }

  tick(deltaSeconds: number) {
    const delta = Math.max(0, Math.min(deltaSeconds, 0.05));
    this.root.scale.lerp(
      new THREE.Vector3(this.scaleTarget, this.scaleTarget, this.scaleTarget),
      1 - Math.exp(-5 * delta),
    );

    const groundY = FOOT_Y * (1 - this.root.scale.y);
    let verticalOffset = this.mode === "fly" ? 1.6 : 0;
    if (this.mode === "jump") {
      this.jumpElapsed = Math.min(JUMP_SECONDS, this.jumpElapsed + delta);
      const progress = this.jumpElapsed / JUMP_SECONDS;
      verticalOffset = 4 * JUMP_HEIGHT * progress * (1 - progress);
      if (progress >= 1) {
        this.mode = "idle";
        this.jumpElapsed = 0;
        verticalOffset = 0;
      }
    }
    this.root.position.y = groundY + verticalOffset;

    if (!this.isMoving && !this.returning) return;

    const target = this.returning
      ? new THREE.Vector3(0, this.root.position.y, 0)
      : this.waypoints[this.waypointIndex]!.clone().setY(this.root.position.y);
    const direction = target.clone().sub(this.root.position);
    const distance = direction.length();
    if (distance < 0.08) {
      this.root.position.copy(target);
      if (this.returning) {
        this.returning = false;
        this.mode = "idle";
        this.scaleTarget = 1;
      } else {
        if (this.loopRoute) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        } else if (this.waypointIndex + 1 < this.waypoints.length) {
          this.waypointIndex += 1;
        } else {
          this.mode = "idle";
        }
      }
      return;
    }

    direction.normalize();
    const modeSpeed = this.mode === "run" ? 2.4 : this.mode === "fly" ? 1.8 : 1.15;
    this.root.position.addScaledVector(
      direction,
      Math.min(distance, delta * modeSpeed * this.speed),
    );
    const desiredYaw = Math.atan2(direction.x, direction.z);
    const yawDelta =
      THREE.MathUtils.euclideanModulo(desiredYaw - this.root.rotation.y + Math.PI, Math.PI * 2) -
      Math.PI;
    this.root.rotation.y += THREE.MathUtils.clamp(yawDelta, -delta * 2.8, delta * 2.8);
  }
}
