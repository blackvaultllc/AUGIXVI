/**
 * Renders the living world scenes (worldScenes.ts) inside the avatar
 * stage: one vertex-colored point cloud for the set, a second cloud
 * for the beach's moving water, and one small cloud per citizen whose
 * positions stream from the people system every frame.
 */
import * as THREE from "three";
import {
  buildScene,
  writeWaterPoints,
  type BuiltFloor,
  type BuiltScene,
  type PortalDef,
  type PortalKind,
  type PortalTransition,
  type WorldSceneId,
} from "./worldScenes";
import { buildPersonPoints, PeopleSim } from "./people";
import { LABEL_CANVAS_HEIGHT, LABEL_FONT_PX, labelCanvasWidth, labelPlaqueSize } from "./labelPlaque";
import {
  BACKDROP_IMAGE_OPACITY,
  backdropById,
  backdropFitSize,
  backdropPlaneSize,
} from "./builder/backdrops";
import { standingFloorImage, type RoomSurfaces } from "./builder/room";

/** Same ground line the SceneManager builds on. */
const GROUND_Y = -3.2;
/** Citizen point size. Raised again for Part 18 (2026-11-21): at
 * 0.04 with soft-edged sprites the figures read as ghosts on his
 * screen; bigger, denser, depth-writing points read as people. */
const CITIZEN_POINT_SIZE = 0.052;
/** The office's set renders finer than the outdoor scenes (same order). */
const OFFICE_STATIC_POINT_SIZE = 0.046;
const STATIC_POINT_SIZE = 0.055;
/** Seconds after a portal trip before another portal can take him. */
const PORTAL_COOLDOWN_S = 1.2;

function makePoints(
  positions: Float32Array,
  colors: Float32Array,
  size: number,
  options?: { solid?: boolean },
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      // SOLID (Part 18): the office set renders with normal blending
      // and depth writes, so desks and walls occlude like furniture
      // instead of glowing through each other additively. The outdoor
      // sets and the water keep the additive glow they were tuned with.
      ...(options?.solid
        ? { transparent: false, opacity: 1, depthWrite: true, blending: THREE.NormalBlending }
        : {
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      sizeAttenuation: true,
    }),
  );
  points.frustumCulled = false;
  return points;
}

/** A department label as a text sprite (Part 9): gold letters on a
 * dark plaque, drawn once to a canvas — no font loading, no assets.
 * Where a 2D canvas is unavailable (test DOMs, odd browsers) the
 * sprite falls back to a plain gold plaque instead of throwing.
 *
 * SCALE (owner defect report 2026-11-22, "the names are way too
 * big"): the first build drew every plaque on one fixed 1024px canvas
 * and scaled every sprite to 4.4 × 0.76 world units — 3.7 desk widths
 * (a desk is ≈1.18) — so at the stage's working camera the plaques
 * filled the frame and painted over the citizens. A plaque is now
 * SIGN-sized in world units (labelPlaque.ts): 0.30 tall, only as wide
 * as its name needs, the canvas fitted to the same numbers. Being
 * world-sized, perspective shrinks it with distance like everything
 * else in the room, at any camera the stage uses. */
function makeLabelSprite(text: string): THREE.Sprite {
  const canvasWidth = labelCanvasWidth(text);
  let texture: THREE.Texture | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = LABEL_CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(10, 14, 24, 0.82)";
      ctx.strokeStyle = "rgba(212, 175, 55, 0.9)";
      ctx.lineWidth = 6;
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 28);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      }
      ctx.font = `700 ${LABEL_FONT_PX}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffd98a";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
      texture = new THREE.CanvasTexture(canvas);
    }
  } catch {
    texture = null;
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      ...(texture ? { map: texture } : { color: 0xd4af37 }),
    }),
  );
  const plaque = labelPlaqueSize(text);
  sprite.scale.set(plaque.width, plaque.height, 1);
  sprite.name = `living-world-label-${text}`;
  return sprite;
}

function disposePoints(points: THREE.Points) {
  points.geometry.dispose();
  const materials = Array.isArray(points.material) ? points.material : [points.material];
  materials.forEach((material) => material.dispose());
}

/**
 * AUGIE'S OWN MATERIAL FAMILY (owner refinement 2026-11-21): the
 * citizens must read as his kind — "look more similar to Augie
 * himself, in their own way" — and the old look bothered his eyes.
 * His body renders as soft round points with controlled light; the
 * citizens rendered as hard square points under ADDITIVE blending,
 * which stacks overlapping points toward white glare wherever a
 * figure is dense. Citizens now get: a radial soft-disc sprite (his
 * round-point signature), NORMAL blending (overlaps occlude instead
 * of blowing out), and colors softened before they ever reach the
 * stage — saturation eased, brightness capped, warmed a breath
 * toward his gold. Their own clothes and skin stay their own.
 */
let softDiscCache: THREE.Texture | null | undefined;
function softDiscTexture(): THREE.Texture | null {
  if (softDiscCache !== undefined) return softDiscCache;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      softDiscCache = null;
      return null;
    }
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.85)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    softDiscCache = new THREE.CanvasTexture(canvas);
  } catch {
    softDiscCache = null;
  }
  return softDiscCache;
}

/** Ease a citizen palette down: less saturation, less glare, a warm lift. */
export function softenCitizenColors(colors: Float32Array): Float32Array {
  const out = new Float32Array(colors.length);
  const warm = [1.0, 0.88, 0.66] as const;
  for (let i = 0; i < colors.length; i += 3) {
    const r = colors[i]!;
    const g = colors[i + 1]!;
    const b = colors[i + 2]!;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const soften = (c: number, w: number) => (c + (luma - c) * 0.12) * 0.94 * 0.95 + w * 0.05;
    out[i] = soften(r, warm[0]);
    out[i + 1] = soften(g, warm[1]);
    out[i + 2] = soften(b, warm[2]);
  }
  return out;
}

function makeCitizenPoints(
  positions: Float32Array,
  colors: Float32Array,
  size: number,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(softenCitizenColors(colors), 3));
  const texture = softDiscTexture();
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      // SOLID CITIZENS (Part 18): the soft disc's faint rim is cut by
      // alphaTest and the points write depth, so a body occludes
      // itself and its neighbors — a person, not a hologram. Without
      // a texture (canvas unavailable) the points fall back to plain
      // opaque squares, still solid.
      transparent: true,
      opacity: 1,
      depthWrite: true,
      alphaTest: texture ? 0.38 : 0,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
      ...(texture ? { map: texture } : {}),
    }),
  );
  points.frustumCulled = false;
  points.name = "living-world-citizen";
  return points;
}

export class WorldSceneManager {
  private group = new THREE.Group();
  private built: BuiltScene | null = null;
  private staticPoints: THREE.Points | null = null;
  private waterPoints: THREE.Points | null = null;
  private roomSet: THREE.Group | null = null;
  private sim: PeopleSim | null = null;
  private citizens: THREE.Points[] = [];
  private labelSprites: THREE.Sprite[] = [];
  private current: WorldSceneId | null = null;
  /** Multi-floor state (the Office): the floors + which one is on stage. */
  private floors: readonly BuiltFloor[] | null = null;
  private floorIndex = 0;
  private portalReadyAt = 0;
  /** Elapsed scene clock — drives the waves and idle motion. */
  private time = 0;
  /**
   * THE ROOM'S SURFACES (Environment Builder, owner order
   * 2026-11-22): the Captain's chosen floor/wall tints and backdrop
   * picture for the Room. Defaults are the shipped Room exactly.
   */
  private roomSurfaces: RoomSurfaces = {
    backdrop: "#f6f2e9",
    backdropImage: null,
    floor: "#93a9c9",
    floorStyle: "color",
    floorImage: null,
    wall: "#aebfd8",
    skyImage: null,
  };
  /**
   * THE WORLD SKY (owner order 2026-11-23): his sky picture on a
   * far plane behind the built world. It lives outside the room
   * set — the room's wall holds the home frame; the sky stands
   * behind EVERYTHING and follows the view's travel in x, the way
   * a real sky stays overhead wherever you walk.
   */
  private skyMesh: THREE.Mesh | null = null;
  private skyImageId: string | null = null;
  private skyViewX = 0;
  /** The stage camera's aspect — the backdrop's cover-fit reads it. */
  private viewAspect = 16 / 9;

  /** The builder's surface choices for the Room; rebuilds the set live. */
  setRoomSurfaces(surfaces: RoomSurfaces) {
    this.roomSurfaces = { ...surfaces };
    if (this.current === "room" && this.roomSet) {
      this.group.remove(this.roomSet);
      this.disposeRoomSet(this.roomSet);
      this.roomSet = this.buildRoomSet();
      this.group.add(this.roomSet);
    }
    this.refreshSky();
  }

  /** The world view travelled — the sky follows in x. */
  setSkyViewX(x: number) {
    this.skyViewX = x;
    if (this.skyMesh) this.skyMesh.position.x = x;
  }

  /** (Re)build the sky plane from the surface choice. */
  private refreshSky() {
    const id = this.roomSurfaces.skyImage;
    if (id !== this.skyImageId) {
      this.skyImageId = id;
      if (this.skyMesh) {
        this.group.remove(this.skyMesh);
        this.disposeRoomSet(this.skyMesh as unknown as THREE.Group);
        this.skyMesh = null;
      }
      const asset = backdropById(id);
      if (asset) {
        const size = backdropPlaneSize(asset, 1500, 430);
        const material = new THREE.MeshBasicMaterial({ depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), material);
        plane.position.set(this.skyViewX, 74, -380);
        plane.name = "living-world-sky";
        try {
          new THREE.TextureLoader().load(asset.src, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
          });
        } catch {
          // No image loading here (test DOMs): no sky stands.
        }
        this.skyMesh = plane;
        this.group.add(plane);
      }
    }
    if (this.skyMesh) this.skyMesh.visible = this.current === "room";
  }

  /** The renderer reports its camera aspect so backdrops cover-fit. */
  setViewAspect(aspect: number) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const changed = Math.abs(aspect - this.viewAspect) > 0.01;
    this.viewAspect = aspect;
    if (changed && this.current === "room" && this.roomSet && this.roomSurfaces.backdropImage) {
      this.group.remove(this.roomSet);
      this.disposeRoomSet(this.roomSet);
      this.roomSet = this.buildRoomSet();
      this.group.add(this.roomSet);
    }
  }

  constructor(scene: THREE.Scene) {
    this.group.name = "augie-living-world";
    this.group.position.y = GROUND_Y;
    scene.add(this.group);
  }

  get currentScene(): WorldSceneId | null {
    return this.current;
  }

  /** Total points on stage for the active scene (set + water + citizens). */
  get particleCount(): number {
    return this.built?.totalParticles ?? 0;
  }

  get citizenCount(): number {
    return this.sim?.people.length ?? 0;
  }

  /** The floor number on stage (1-based), or null outside the Office. */
  get currentFloor(): number | null {
    return this.floors ? (this.floors[this.floorIndex]?.floor ?? null) : null;
  }

  /** The portal of the given kind on the active floor, if it has one. */
  portalOfKind(kind: PortalKind): PortalDef | null {
    if (!this.floors) return null;
    return this.floors[this.floorIndex]?.portals.find((portal) => portal.kind === kind) ?? null;
  }

  setScene(id: WorldSceneId) {
    this.clear();
    this.built = buildScene(id);
    this.current = id;
    this.refreshSky();
    if (id === "room") {
      // THE ROOM (owner order 2026-11-22): no point set at all — the
      // room is drawn as its SURFACES: a floor plane in his color or
      // his picture, a plain back wall in his wall color, and his
      // backdrop picture at full strength when he picks one. No grid
      // aspect anywhere (his decision, same day: "Remove the grid
      // entirely"). A development room: bright, quiet, and empty on
      // purpose, so anything can be brought up in it.
      this.roomSet = this.buildRoomSet();
      this.group.add(this.roomSet);
      return;
    }
    if (this.built.floors) {
      this.floors = this.built.floors;
      this.loadFloor(0);
      return;
    }
    this.staticPoints = makePoints(
      this.built.staticPositions,
      this.built.staticColors,
      STATIC_POINT_SIZE,
    );
    this.staticPoints.name = `living-world-${id}`;
    this.group.add(this.staticPoints);
    if (this.built.water) {
      this.waterPoints = makePoints(
        this.built.water.positions.slice(),
        this.built.water.colors,
        0.06,
      );
      this.waterPoints.name = "living-world-water";
      this.group.add(this.waterPoints);
    }
    this.spawnCitizens(this.built.people);
  }

  /**
   * The Room's only furniture: its surfaces. The back wall is a
   * plain wall in his wall color carrying his chosen backdrop
   * picture at full strength; the floor is a solid color or a
   * picture — his choice, and either one covers whole. NO GRID
   * ASPECT ANYWHERE (owner decision 2026-11-22: "Remove the grid
   * entirely" — the floor grid and the back-wall grid lines that
   * used to draw this room are gone). Planes, not points — the one
   * scene in the world not made of sand.
   */
  private buildRoomSet(): THREE.Group {
    const set = new THREE.Group();
    set.name = "living-world-room";
    const surfaces = this.roomSurfaces;
    // THE UNBUILT WORLD IS DARKNESS (owner order 2026-11-23): past
    // the home plot's ground, the world is a dark void — no fake
    // terrain, nothing pretending to be land he has not built. One
    // near-black plane runs under everything, out to the horizon —
    // as far as the eye can see; claimed plots and the home floor
    // lay over it. (This is world terrain at world scale, NOT the
    // Room's floor grid — that grid stays deleted, by his order.)
    const voidPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#04050a") }),
    );
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.y = -0.05;
    voidPlane.name = "living-world-room-void";
    set.add(voidPlane);
    // THE BACKDROP PICTURE (Environment Builder; fit corrected by
    // his eye-check 2026-11-22 ~19:40 EST): one of the Captain's
    // theme pictures, CONTAIN-fit on the back wall — the WHOLE
    // picture visible, centered in the window, as large as
    // whole-picture framing allows, aspect intact, never zoomed,
    // never cropped — and rendered TRUE, at full strength (owner
    // correction 2026-11-22: the veil that used to hang over it
    // washed the picture out; the picture itself is the backdrop,
    // a composed stage scene. The interface's panels are solid and
    // carry the text; the room carries the art.)
    const backdrop = backdropById(surfaces.backdropImage);
    if (backdrop) {
      // The view window the picture must fit inside: the camera
      // (fov 40, z = 11) sees ≈15.7 world units of height at the
      // wall's depth; above the floor line that is ≈10.3. The
      // window is that height and the camera aspect wide — no
      // cover bleed factor: contain-fit reads the true window, so
      // what he sees is the whole picture, centered.
      const viewH = 10.4;
      const viewW = viewH * this.viewAspect;
      const size = backdropFitSize(backdrop, viewW, viewH);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: BACKDROP_IMAGE_OPACITY,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), material);
      // Centered in the window: middle of the stage horizontally,
      // middle of the above-floor window vertically.
      plane.position.set(0, viewH / 2, -10.6);
      plane.name = "living-world-room-backdrop";
      set.add(plane);
      try {
        new THREE.TextureLoader().load(backdrop.src, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.needsUpdate = true;
        });
      } catch {
        // No image loading here (test DOMs): the room still renders;
        // the picture simply never lands.
      }
    }
    // THE BACK WALL (owner decision 2026-11-22): a plain wall in
    // his wall color. The grid lines that used to draw it are gone;
    // his backdrop picture (above) hangs in front of it, and where
    // no picture is picked the wall itself is the room's back.
    // THE HOLDER GOES BLACK (owner eye-check 2026-11-23): "make
    // the white background holder black so that way the picture
    // sticks out better." While a backdrop picture is up, the wall
    // it hangs on renders BLACK — one composition: black around a
    // whole, centered picture. A room with no picture picked keeps
    // his chosen wall color exactly as before.
    const wallPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 14),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(backdrop ? "#000000" : surfaces.wall),
        depthWrite: false,
      }),
    );
    wallPlane.position.set(0, 5.2, -10.7);
    wallPlane.name = "living-world-room-wall";
    set.add(wallPlane);
    // THE FLOOR (owner orders 2026-11-22): the floor is what he
    // chose — a solid color or a picture — and either one COVERS,
    // whole and opaque. The grid floor is gone entirely (his
    // decision); there are no grid lines to bleed through anything.
    if (surfaces.floorStyle === "picture" && standingFloorImage(surfaces)) {
      // The picture floor: cover-fit across the framed floor (the
      // room's bounds, ROOM_BOUNDS: x ±10.5, z −8.5…2.5), opaque.
      const floorArt = backdropById(standingFloorImage(surfaces));
      if (floorArt) {
        const size = backdropPlaneSize(floorArt, 21.6, 11.6);
        const material = new THREE.MeshBasicMaterial({ depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), material);
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(0, 0.01, -3);
        plane.name = "living-world-room-floor-picture";
        set.add(plane);
        try {
          new THREE.TextureLoader().load(floorArt.src, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
          });
        } catch {
          // No image loading here (test DOMs): the floor simply
          // never lands; nothing pretends otherwise.
        }
      }
    } else {
      // The solid color floor: one opaque plane in his color.
      const floorPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 36),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(surfaces.floor),
          depthWrite: false,
        }),
      );
      floorPlane.rotation.x = -Math.PI / 2;
      floorPlane.position.y = 0.01;
      floorPlane.name = "living-world-room-floor-solid";
      set.add(floorPlane);
    }
    return set;
  }

  private disposeRoomSet(set: THREE.Group) {
    set.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | undefined;
      if (material) {
        const basic = material as THREE.MeshBasicMaterial;
        basic.map?.dispose();
        material.dispose();
      }
    });
  }

  /** Swap the stage to one of the active scene's floors. */
  private loadFloor(index: number) {
    if (!this.floors) return;
    const floor = this.floors[index];
    if (!floor) return;
    this.floorIndex = index;
    this.clearFloorPoints();
    this.staticPoints = makePoints(floor.staticPositions, floor.staticColors, OFFICE_STATIC_POINT_SIZE, {
      solid: true,
    });
    this.staticPoints.name = `living-world-office-floor-${floor.floor}`;
    this.group.add(this.staticPoints);
    for (const label of floor.labels) {
      const sprite = makeLabelSprite(label.text);
      sprite.position.set(label.x, label.y, label.z);
      this.labelSprites.push(sprite);
      this.group.add(sprite);
    }
    this.spawnCitizens(floor.people);
  }

  /** Go to a floor by number. False when the scene has no such floor. */
  setFloor(floorNumber: number): boolean {
    if (!this.floors) return false;
    const index = this.floors.findIndex((floor) => floor.floor === floorNumber);
    if (index < 0) return false;
    this.loadFloor(index);
    return true;
  }

  /**
   * PORTALS (owner order 2026-11-21): if Augie stands inside a portal
   * ring on the active floor, carry him through — the floor swaps
   * under him and the caller lands him at the arrival point from the
   * returned transition. A short cooldown after each trip keeps a
   * doorway from firing twice while he steps out of the far ring.
   */
  checkPortals(x: number, z: number): PortalTransition | null {
    if (!this.floors || this.time < this.portalReadyAt) return null;
    const floor = this.floors[this.floorIndex];
    if (!floor) return null;
    for (const portal of floor.portals) {
      if (Math.hypot(x - portal.x, z - portal.z) > portal.radius) continue;
      if (!this.setFloor(portal.toFloor)) return null;
      this.portalReadyAt = this.time + PORTAL_COOLDOWN_S;
      const arrived = this.floors[this.floorIndex]!;
      return {
        toFloor: portal.toFloor,
        floorName: arrived.name,
        line: arrived.line,
        arriveX: portal.arriveX,
        arriveZ: portal.arriveZ,
      };
    }
    return null;
  }

  private spawnCitizens(defs: BuiltScene["people"]) {
    this.sim = new PeopleSim(defs);
    this.citizens = this.sim.people.map((person) => {
      const figure = buildPersonPoints(person.def.appearance, {
        mode: person.mode,
        gaitTime: 0,
        time: 0,
      });
      const points = makeCitizenPoints(figure.positions.slice(), figure.colors, CITIZEN_POINT_SIZE);
      points.position.set(person.x, 0, person.z);
      points.rotation.y = person.heading;
      this.group.add(points);
      return points;
    });
  }

  tick(deltaSeconds: number) {
    if (!this.built) return;
    this.time += deltaSeconds;
    if (this.waterPoints && this.built.water) {
      const attribute = this.waterPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      writeWaterPoints(this.time, attribute.array as Float32Array);
      attribute.needsUpdate = true;
    }
    if (this.sim) {
      this.sim.tick(deltaSeconds);
      this.sim.people.forEach((person, index) => {
        const points = this.citizens[index];
        if (!points) return;
        const figure = buildPersonPoints(person.def.appearance, {
          mode: person.mode,
          gaitTime: person.gaitTime,
          time: this.time,
        });
        const attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute;
        (attribute.array as Float32Array).set(figure.positions);
        attribute.needsUpdate = true;
        points.position.set(person.x, 0, person.z);
        points.rotation.y = person.heading;
      });
    }
  }

  /** Remove the on-stage set + citizens (a floor swap keeps the scene). */
  private clearFloorPoints() {
    if (this.staticPoints) {
      this.group.remove(this.staticPoints);
      disposePoints(this.staticPoints);
      this.staticPoints = null;
    }
    for (const citizen of this.citizens) {
      this.group.remove(citizen);
      disposePoints(citizen);
    }
    this.citizens = [];
    for (const sprite of this.labelSprites) {
      this.group.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.labelSprites = [];
    this.sim = null;
  }

  private clear() {
    this.clearFloorPoints();
    if (this.waterPoints) {
      this.group.remove(this.waterPoints);
      disposePoints(this.waterPoints);
      this.waterPoints = null;
    }
    if (this.roomSet) {
      this.group.remove(this.roomSet);
      this.roomSet.traverse((child) => {
        const grid = child as THREE.GridHelper;
        if (grid.geometry) grid.geometry.dispose();
        const material = grid.material as THREE.Material | undefined;
        if (material) material.dispose();
      });
      this.roomSet = null;
    }
    this.floors = null;
    this.floorIndex = 0;
    this.portalReadyAt = 0;
    this.built = null;
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.current = null;
  }
}
