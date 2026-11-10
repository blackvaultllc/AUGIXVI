import * as THREE from "three";

const FOOT_Y = -3.2;

export class AvatarLocomotion {
  private scaleTarget = 1;
  private walking = false;
  private returning = false;
  private looking = false;
  private waypointIndex = 0;
  private readonly waypoints = [
    new THREE.Vector3(-3.2, 0, 0),
    new THREE.Vector3(3.2, 0, 0),
    new THREE.Vector3(3.2, 0, 2.2),
    new THREE.Vector3(-3.2, 0, 2.2),
    new THREE.Vector3(-3.2, 0, 0),
  ];

  constructor(private root: THREE.Group) {}

  get isWalking() {
    return this.walking;
  }

  get isMoving() {
    return this.walking || this.returning;
  }

  get isLookingAround() {
    return this.looking;
  }

  shrink() {
    this.scaleTarget = 0.34;
  }

  grow() {
    this.walking = false;
    this.returning = false;
    this.looking = false;
    this.scaleTarget = 1;
  }

  walk() {
    this.scaleTarget = 0.34;
    this.returning = false;
    this.looking = false;
    this.walking = true;
  }

  lookAround() {
    this.looking = true;
  }

  comeBack() {
    this.walking = false;
    this.returning = true;
    this.looking = false;
  }

  stop() {
    this.walking = false;
    this.returning = false;
    this.looking = false;
  }

  tick(deltaSeconds: number) {
    this.root.scale.lerp(
      new THREE.Vector3(this.scaleTarget, this.scaleTarget, this.scaleTarget),
      1 - Math.exp(-5 * deltaSeconds),
    );
    this.root.position.y = FOOT_Y * (1 - this.root.scale.y);
    if (!this.isMoving) return;

    const target = this.returning
      ? new THREE.Vector3(0, this.root.position.y, 0)
      : this.waypoints[this.waypointIndex]!.clone().setY(this.root.position.y);
    const delta = target.clone().sub(this.root.position);
    const distance = delta.length();
    if (distance < 0.08) {
      this.root.position.copy(target);
      if (this.returning) {
        this.returning = false;
        this.scaleTarget = 1;
      } else {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      }
      return;
    }

    delta.normalize();
    this.root.position.addScaledVector(delta, Math.min(distance, deltaSeconds * 1.15));
    const desiredYaw = Math.atan2(delta.x, delta.z);
    const yawDelta =
      THREE.MathUtils.euclideanModulo(desiredYaw - this.root.rotation.y + Math.PI, Math.PI * 2) -
      Math.PI;
    this.root.rotation.y += THREE.MathUtils.clamp(
      yawDelta,
      -deltaSeconds * 2.8,
      deltaSeconds * 2.8,
    );
  }
}
